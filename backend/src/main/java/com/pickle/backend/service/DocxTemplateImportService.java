package com.pickle.backend.service;

import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import org.jsoup.Jsoup;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import com.pickle.backend.dto.TemplateFieldMapping;
import com.pickle.backend.entity.DocumentTemplate;
import com.pickle.backend.entity.Role;
import com.pickle.backend.repository.DocumentTemplateRepository;
import com.pickle.backend.repository.UserRepository;

@Service
public class DocxTemplateImportService {
    private final UserRepository users;
    private final DocumentTemplateRepository templates;
    private final DocxHtmlConverter converter;
    private final TemplateMappingService mapping;
    private final ObjectMapper json;

    public DocxTemplateImportService(UserRepository users, DocumentTemplateRepository templates,
            DocxHtmlConverter converter, TemplateMappingService mapping, ObjectMapper json) {
        this.users = users; this.templates = templates; this.converter = converter;
        this.mapping = mapping; this.json = json;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> preview(Long actorId, MultipartFile file) {
        requireAdmin(actorId);
        var bytes = readFile(file);
        var converted = converter.convert(bytes);
        var html = Jsoup.parseBodyFragment(converted.html());
        var cells = html.select("td[data-cell-id],th[data-cell-id]").stream().map(cell ->
                Map.<String, Object>of("cell_id", cell.id(), "text", cell.ownText().isBlank() ? cell.text() : cell.ownText(),
                        "rowspan", cell.hasAttr("rowspan") ? cell.attr("rowspan") : "1",
                        "colspan", cell.hasAttr("colspan") ? cell.attr("colspan") : "1")).toList();
        return Map.of("file_name", fileName(file), "source_sha256", sha(bytes),
                "preview_html", converted.html(), "cells", cells, "warnings", converted.warnings());
    }

    @Transactional
    public Map<String, Object> save(Long actorId, MultipartFile file, String name,
            String sourceSha, String fieldsJson) {
        requireAdmin(actorId);
        String title = name == null ? "" : name.strip();
        if (title.isEmpty() || title.codePointCount(0, title.length()) > 255) {
            throw bad("template_name은 1~255자여야 합니다.");
        }
        if (fieldsJson == null || fieldsJson.length() > 262_144) { throw bad("fields JSON 길이를 확인해 주세요."); }
        var bytes = readFile(file);
        if (sourceSha == null || !sha(bytes).equals(sourceSha.strip().toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "미리보기 파일과 저장 파일이 다릅니다. 미리보기를 다시 실행하세요.");
        }
        TemplateFieldMapping[] fields;
        try { fields = json.readValue(fieldsJson, TemplateFieldMapping[].class); }
        catch (Exception ex) { throw bad("fields는 올바른 필드 매핑 JSON 배열이어야 합니다."); }
        var converted = converter.convert(bytes);
        var mapped = mapping.map(converted.html(), fields == null ? null : Arrays.asList(fields), title);
        var template = new DocumentTemplate();
        template.setTemplateName(title);
        template.setFileName(fileName(file));
        template.setHtmlContent(mapped.html());
        template.setTemplateSchema(mapped.schema());
        template.setPlaceholderKeys(mapped.keys());
        template.setTemplateFields(mapped.fields());
        template.setActive(true);
        var saved = templates.saveAndFlush(template);
        return Map.of("id", saved.getId(), "template_name", saved.getTemplateName(),
                "file_name", saved.getFileName(), "html_content", saved.getHtmlContent(),
                "template_schema", saved.getTemplateSchema(), "placeholder_keys", saved.getPlaceholderKeys(),
                "template_fields", saved.getTemplateFields(), "is_active", saved.isActive(),
                "warnings", converted.warnings());
    }

    private void requireAdmin(Long actorId) {
        var actor = users.findById(actorId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive()) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비활성 계정입니다."); }
        if (actor.getRole() != Role.ADMIN) { throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN 권한이 필요합니다."); }
    }

    private byte[] readFile(MultipartFile file) {
        if (file == null || file.isEmpty()) { throw bad("DOCX 파일은 필수입니다."); }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "DOCX는 최대 10MB입니다.");
        }
        if (!fileName(file).toLowerCase(Locale.ROOT).endsWith(".docx")) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ".docx 파일만 지원합니다. .doc는 Word에서 .docx로 저장해 주세요.");
        }
        try { return file.getBytes(); }
        catch (java.io.IOException ex) { throw bad("업로드 파일을 읽을 수 없습니다."); }
    }

    private static String fileName(MultipartFile file) {
        String raw = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().replace('\\', '/');
        String name = raw.substring(raw.lastIndexOf('/') + 1).strip();
        if (name.isEmpty() || name.codePointCount(0, name.length()) > 255) { throw bad("파일 이름 길이를 확인해 주세요."); }
        return name;
    }

    private static String sha(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
