package com.pickle.backend.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Entities;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.TemplateFieldMapping;

@Component
public class TemplateMappingService {
    private static final Pattern KEY = Pattern.compile("[a-z][a-z0-9_]{0,79}");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([a-z][a-z0-9_]{0,79})\\}\\}");
    public record Mapped(String html, Map<String, Object> schema, List<String> keys,
            List<Map<String, Object>> fields) {}

    public Mapped map(String html, List<TemplateFieldMapping> input, String name) {
        if (input == null || input.isEmpty() || input.size() > 300) {
            throw bad("fields는 1~300개의 필드 배열이어야 합니다.");
        }
        var document = Jsoup.parseBodyFragment(html);
        document.outputSettings().prettyPrint(false);
        var keys = new LinkedHashSet<String>();
        var targetsUsed = new LinkedHashSet<String>();
        var normalized = new ArrayList<Map<String, Object>>();
        var properties = new LinkedHashMap<String, Object>();
        var required = new ArrayList<String>();
        for (var field : input) {
            if (field == null) { throw bad("fields에 null이 들어갈 수 없습니다."); }
            String key = text(field.key());
            if (!KEY.matcher(key).matches()) { throw bad("필드 key는 영문 소문자로 시작하는 snake_case여야 합니다: " + key); }
            if (!keys.add(key)) { throw bad("중복 key입니다. 반복 셀은 한 필드의 cell_ids에 넣어 주세요: " + key); }
            String type = text(field.type());
            if (type.isEmpty()) { type = "string"; }
            if (!Set.of("string", "number", "date", "textarea").contains(type)) {
                throw bad("지원하지 않는 필드 type: " + type);
            }
            String label = text(field.label()).isEmpty() ? key : text(field.label());
            String description = text(field.description());
            String cellTemplate = text(field.cellTemplate());
            var ids = collectTargets(field);
            var originalCells = new LinkedHashMap<String, String>();
            if (!cellTemplate.isEmpty() && ids.isEmpty()) {
                throw bad("cell_template을 지정한 필드에는 대상 셀이 필요합니다: " + key);
            }
            for (int index = 0; index < ids.size(); index++) {
                String id = ids.get(index);
                if (!targetsUsed.add(id)) { throw bad("한 셀을 여러 필드가 덮어쓸 수 없습니다: " + id); }
                Element cell = document.getElementById(id);
                if (cell == null || !(cell.tagName().equals("td") || cell.tagName().equals("th"))) {
                    throw bad("미리보기에 없는 셀 ID입니다: " + id);
                }
                if (!cell.select("table").isEmpty()) {
                    throw bad("중첩 표를 포함한 상위 셀은 통째로 매핑할 수 없습니다. 내부 입력 셀을 선택하세요: " + id);
                }
                originalCells.put(id, cell.html());
                cell.empty();
                if (index == 0 && !cellTemplate.isEmpty()) { appendPattern(cell, cellTemplate); }
                else { cell.appendElement("span").addClass("ph").text("{{" + key + "}}"); }
            }
            Map<String, Object> clean = new LinkedHashMap<>();
            clean.put("key", key); clean.put("label", label); clean.put("type", type);
            clean.put("required", Boolean.TRUE.equals(field.required()));
            clean.put("description", description);
            clean.put("cell_id", ids.isEmpty() ? "" : ids.get(0));
            clean.put("cell_ids", ids);
            clean.put("locators", ids.stream().map(id -> Map.of("type", "cell", "cell_id", id)).toList());
            clean.put("cell_template", cellTemplate);
            clean.put("original_cells", originalCells);
            normalized.add(clean);
            Map<String, Object> property = new LinkedHashMap<>();
            property.put("type", type.equals("number") ? "number" : "string");
            property.put("title", label);
            if (!description.isEmpty()) { property.put("description", description); }
            if (type.equals("date")) { property.put("format", "date"); }
            if (type.equals("textarea")) { property.put("x-display", "textarea"); }
            properties.put(key, property);
            if (Boolean.TRUE.equals(field.required())) { required.add(key); }
        }
        String finalHtml = document.body().html();
        var rawTokens = Pattern.compile("\\{\\{([^{}]*)\\}\\}").matcher(document.body().text());
        while (rawTokens.find()) {
            if (!KEY.matcher(rawTokens.group(1)).matches()) {
                throw bad("잘못된 placeholder입니다: " + rawTokens.group());
            }
        }
        var found = new LinkedHashSet<String>();
        var matcher = PLACEHOLDER.matcher(document.body().text());
        while (matcher.find()) { found.add(matcher.group(1)); }
        var missing = new LinkedHashSet<>(keys); missing.removeAll(found);
        var unknown = new LinkedHashSet<>(found); unknown.removeAll(keys);
        if (!missing.isEmpty() || !unknown.isEmpty()) {
            throw bad("필드와 HTML placeholder 불일치. 누락=" + missing + ", 미등록=" + unknown);
        }
        if (finalHtml.length() > DocxHtmlConverter.MAX_HTML) { throw bad("최종 HTML 길이가 너무 큽니다."); }
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object"); schema.put("title", name);
        schema.put("properties", properties); schema.put("required", required);
        schema.put("additionalProperties", false);
        return new Mapped(finalHtml, schema, List.copyOf(keys), normalized);
    }

    public record EditingBase(String html, List<Map<String, Object>> cells, List<String> warnings) {}

    /** 저장 당시 원본 셀 내용을 복원한 편집용 HTML. 기존 문서의 HTML은 변경하지 않습니다. */
    public EditingBase editingBase(String html, List<Map<String, Object>> fields) {
        var document = Jsoup.parseBodyFragment(html == null ? "" : html);
        document.outputSettings().prettyPrint(false);
        var restored = new LinkedHashSet<String>();
        var warnings = new ArrayList<String>();
        boolean legacy = false;
        for (var field : fields == null ? List.<Map<String, Object>>of() : fields) {
            var ids = new LinkedHashSet<String>();
            Object rawIds = field.get("cell_ids");
            if (rawIds instanceof List<?> list) {
                for (Object id : list) if (id instanceof String value && !value.isBlank()) ids.add(value);
            }
            if (ids.isEmpty() && field.get("locators") instanceof List<?> locators) {
                for (Object locator : locators) if (locator instanceof Map<?, ?> m && m.get("cell_id") instanceof String id) ids.add(id);
            }
            if (ids.isEmpty() && field.get("cell_id") instanceof String id && !id.isBlank()) ids.add(id);
            Map<?, ?> originals = field.get("original_cells") instanceof Map<?, ?> map ? map : Map.of();
            for (String id : ids) {
                if (!restored.add(id)) continue;
                var cell = document.getElementById(id);
                if (cell == null) continue;
                if (originals.get(id) instanceof String original) cell.html(original);
                else legacy = true;
                // 원본 DOCX에 직접 적혀 있던 placeholder도 이전 위치에 남기지 않습니다.
                cell.forEachNode(node -> {
                    if (node instanceof org.jsoup.nodes.TextNode text) {
                        text.text(text.getWholeText().replaceAll("\\{\\{[^{}]*\\}\\}", ""));
                    }
                });
                for (var span : cell.select("span.ph")) {
                    span.removeClass("ph");
                    if (span.text().isEmpty()) span.remove();
                }
            }
        }
        if (legacy) warnings.add("이 양식은 원본 셀 내용이 보관되기 전에 저장되었습니다. 기존 placeholder는 지우지만, 과거에 덮어쓴 원문은 복원할 수 없습니다. 연결을 옮긴 뒤 이전 셀을 확인하세요.");
        var cells = document.select("td[data-cell-id],th[data-cell-id]").stream().map(cell -> Map.<String, Object>of(
                "cell_id", cell.id(), "text", cell.text(),
                "rowspan", cell.hasAttr("rowspan") ? cell.attr("rowspan") : "1",
                "colspan", cell.hasAttr("colspan") ? cell.attr("colspan") : "1")).toList();
        return new EditingBase(document.body().html(), cells, warnings);
    }

    private static List<String> collectTargets(TemplateFieldMapping field) {
        var ids = new LinkedHashSet<String>();
        if (field.cellIds() != null && !field.cellIds().isEmpty()) {
            for (String id : field.cellIds()) { addTarget(ids, id); }
        } else {
            if (field.locators() != null) {
                for (var locator : field.locators()) {
                    if (locator != null) { addTarget(ids, locator.cellId()); }
                }
            }
            addTarget(ids, field.cellId());
        }
        return List.copyOf(ids);
    }

    private static void addTarget(Set<String> ids, String id) {
        if (text(id).isEmpty()) { return; }
        if (!text(id).matches("t[0-9]+_r[0-9]+_c[0-9]+")) { throw bad("잘못된 셀 ID입니다: " + id); }
        ids.add(text(id));
    }

    private static void appendPattern(Element cell, String pattern) {
        var matcher = PLACEHOLDER.matcher(pattern);
        int offset = 0;
        while (matcher.find()) {
            DocxHtmlConverter.appendText(cell, pattern.substring(offset, matcher.start()));
            cell.appendElement("span").addClass("ph").text(matcher.group());
            offset = matcher.end();
        }
        DocxHtmlConverter.appendText(cell, pattern.substring(offset));
    }

    // 향후 AI가 생성한 값 적용에 사용할 수 있습니다. 값을 HTML로 해석하지 않습니다.
    public String renderValues(String html, Map<String, ?> values) {
        var matcher = PLACEHOLDER.matcher(html);
        var result = new StringBuilder();
        while (matcher.find()) {
            Object value = values == null ? null : values.get(matcher.group(1));
            if (value != null && !(value instanceof String || value instanceof Number || value instanceof Boolean)) {
                throw bad("치환 값은 문자열/숫자/불리언이어야 합니다.");
            }
            String safe = Entities.escape(value == null ? "" : value.toString())
                    .replace("\r\n", "\n").replace("\n", "<br/>");
            matcher.appendReplacement(result, java.util.regex.Matcher.quoteReplacement(safe));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private static String text(String value) { return value == null ? "" : value.strip(); }
    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
