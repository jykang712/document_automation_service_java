package com.pickle.backend.service;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.jsoup.nodes.Element;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.Node;

@Component
public class DocxHtmlConverter {
    public static final int MAX_HTML = 1_000_000;
    private static final String WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final String STYLE = """
            <style>
            .doc-wrap{font-family:'Malgun Gothic',sans-serif;line-height:1.6;color:#111;background:#fff;padding:12px}
            .doc-wrap table{border-collapse:collapse;width:100%;margin:12px 0}
            .doc-wrap td{border:1px solid #999;padding:8px;vertical-align:top;font-size:14px}
            .doc-wrap p{margin:6px 0;white-space:pre-wrap}
            .doc-wrap .ph{color:#2563eb;font-weight:600}
            </style>
            """;

    public record Conversion(String html, List<String> warnings) {}
    private record Merge(Element element, int width) {}

    public Conversion convert(byte[] bytes) {
        var warnings = new ArrayList<String>();
        warnings.add("기본 표·문단 변환입니다. 머리글/바닥글, 도형, 정확한 페이지 배치는 재현하지 않습니다.");
        var wrapper = new Element("div").addClass("doc-wrap");
        try (var document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            if (!document.getAllPictures().isEmpty()) {
                warnings.add("이미지는 이번 변환에서 제외됩니다. 로고/직인 등이 필요한 양식은 미리보기를 확인하세요.");
            }
            appendBody(document.getBodyElements(), wrapper, new AtomicInteger(), new AtomicInteger(), 0);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw bad("DOCX를 읽을 수 없습니다. 암호화되지 않은 정상 .docx 파일을 확인해 주세요.");
        }
        String html = STYLE + wrapper.outerHtml();
        if (html.length() > MAX_HTML) { throw bad("변환 HTML이 최대 길이 1,000,000을 초과합니다."); }
        if (wrapper.text().isBlank() && wrapper.select("td").isEmpty()) {
            throw bad("변환할 문단이나 표가 없습니다.");
        }
        return new Conversion(html, List.copyOf(warnings));
    }

    private void appendBody(List<IBodyElement> body, Element parent, AtomicInteger tables,
            AtomicInteger cells, int depth) {
        if (depth > 20) { throw bad("중첩 표 깊이가 너무 큽니다."); }
        for (var item : body) {
            if (item instanceof XWPFParagraph paragraph) {
                appendParagraph(paragraph, parent);
            } else if (item instanceof XWPFTable table) {
                appendTable(table, parent, tables, cells, depth);
            }
        }
    }

    private void appendParagraph(XWPFParagraph paragraph, Element parent) {
        Element p = parent.appendElement("p");
        String alignment = switch (paragraph.getAlignment()) {
            case CENTER -> "center";
            case RIGHT -> "right";
            case BOTH, DISTRIBUTE -> "justify";
            default -> "left";
        };
        p.attr("style", "text-align:" + alignment);
        if (paragraph.getRuns().isEmpty()) { appendText(p, paragraph.getText()); }
        for (var run : paragraph.getRuns()) {
            Element span = p.appendElement("span");
            String style = "";
            if (run.isBold()) { style += "font-weight:bold;"; }
            if (run.isItalic()) { style += "font-style:italic;"; }
            if (run.getUnderline() != UnderlinePatterns.NONE) { style += "text-decoration:underline;"; }
            String color = run.getColor();
            if (color != null && color.matches("[0-9a-fA-F]{6}")) { style += "color:#" + color + ";"; }
            if (!style.isEmpty()) { span.attr("style", style); }
            appendText(span, run.text());
        }
        if (p.text().isEmpty()) { p.appendElement("br"); }
    }

    private void appendTable(XWPFTable table, Element parent, AtomicInteger tables,
            AtomicInteger cells, int depth) {
        int tableIndex = tables.getAndIncrement();
        Element htmlTable = parent.appendElement("table");
        Map<Integer, Merge> previousMerges = new HashMap<>();
        int rowIndex = 0;
        for (var row : table.getRows()) {
            Element tr = htmlTable.appendElement("tr");
            var nextMerges = new HashMap<Integer, Merge>();
            Node rowProperties = child(row.getCtRow().getDomNode(), "trPr");
            int column = integer(child(rowProperties, "gridBefore"), 0);
            if (column > 0) { tr.appendElement("td").attr("colspan", String.valueOf(column)); }
            for (var cell : row.getTableCells()) {
                if (cells.incrementAndGet() > 5000) { throw bad("표 셀은 최대 5,000개까지 지원합니다."); }
                Node properties = child(cell.getCTTc().getDomNode(), "tcPr");
                int width = integer(child(properties, "gridSpan"), 1);
                Node vertical = child(properties, "vMerge");
                boolean continuation = vertical != null && !"restart".equals(value(vertical));
                Merge prior = previousMerges.get(column);
                if (continuation) {
                    if (prior == null || prior.width() != width) {
                        throw bad("지원하지 않는 세로 병합 구조입니다. Word에서 표 병합 상태를 확인해 주세요.");
                    }
                    int rowspan = prior.element().hasAttr("rowspan")
                            ? Integer.parseInt(prior.element().attr("rowspan")) : 1;
                    prior.element().attr("rowspan", String.valueOf(rowspan + 1));
                    if (!cell.getText().isBlank()) {
                        appendBody(cell.getBodyElements(), prior.element(), tables, cells, depth + 1);
                    }
                    nextMerges.put(column, prior);
                } else {
                    String id = "t" + tableIndex + "_r" + rowIndex + "_c" + column;
                    Element td = tr.appendElement("td").attr("id", id).attr("data-cell-id", id);
                    if (width > 1) { td.attr("colspan", String.valueOf(width)); }
                    appendBody(cell.getBodyElements(), td, tables, cells, depth + 1);
                    if (vertical != null) { nextMerges.put(column, new Merge(td, width)); }
                }
                column += width;
            }
            previousMerges = nextMerges;
            rowIndex++;
        }
    }

    private static Node child(Node parent, String name) {
        if (parent == null) { return null; }
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (WORD_NS.equals(n.getNamespaceURI()) && name.equals(n.getLocalName())) { return n; }
        }
        return null;
    }

    private static String value(Node node) {
        if (node == null || node.getAttributes() == null) { return ""; }
        Node attr = node.getAttributes().getNamedItemNS(WORD_NS, "val");
        return attr == null ? "" : attr.getNodeValue();
    }

    private static int integer(Node node, int fallback) {
        String raw = value(node);
        if (raw.isEmpty()) { return fallback; }
        try {
            int v = Integer.parseInt(raw);
            if (v < 0 || v > 1000) { throw bad("표 병합/열 수가 지원 범위를 벗어납니다."); }
            return Math.max(fallback, v);
        } catch (NumberFormatException ex) { throw bad("잘못된 표 병합/열 값입니다."); }
    }

    public static void appendText(Element element, String text) {
        String[] lines = (text == null ? "" : text).replace("\r\n", "\n").split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) { element.appendElement("br"); }
            element.appendText(lines[i]);
        }
    }

    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
