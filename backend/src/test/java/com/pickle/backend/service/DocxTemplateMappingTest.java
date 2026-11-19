package com.pickle.backend.service;

import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.TemplateFieldMapping;
import static org.junit.jupiter.api.Assertions.*;

class DocxTemplateMappingTest {
    private final DocxHtmlConverter converter = new DocxHtmlConverter();
    private final TemplateMappingService mapping = new TemplateMappingService();

    private String source() throws Exception {
        try (var in = getClass().getResourceAsStream("/sample-approval.docx")) {
            assertNotNull(in);
            return converter.convert(in.readAllBytes()).html();
        }
    }
    private TemplateFieldMapping field(String key, List<String> cells, String pattern) {
        return new TemplateFieldMapping(key, key, "string", true, "", null, cells, null, pattern);
    }
    @Test void convertsParagraphsCellsAndMerges() throws Exception {
        var html = Jsoup.parseBodyFragment(source());
        assertNotNull(html.getElementById("t0_r0_c1"));
        assertEquals("3", html.getElementById("t1_r0_c0").attr("colspan"));
        assertEquals("2", html.getElementById("t1_r1_c0").attr("rowspan"));
        assertEquals("신청자",html.getElementById("t0_r0_c0").text());
    }
    @Test void repeatedAndCompositeFieldsHaveConsistentSchema() throws Exception {
        var fields = List.of(
                field("requester",List.of("t0_r0_c1","t0_r4_c1"),""),
                field("year",List.of("t0_r2_c1"),"{{year}}년 {{month}}월 {{day}}일"),
                field("month",List.of(),""), field("day",List.of(),""));
        var result = mapping.map(source(),fields,"신청서");
        assertEquals(4,result.keys().size());
        assertEquals(2,result.html().split("\\{\\{requester\\}\\}",-1).length-1);
        assertTrue(result.html().contains("{{month}}"));
        assertEquals(4,((Map<?,?>)result.schema().get("properties")).size());
        assertEquals(4,((List<?>)result.schema().get("required")).size());
        assertEquals(4,result.fields().size());
    }
    @Test void rejectsDuplicatesUnknownCellsAndUnmappedFields() throws Exception {
        String html=source();
        assertThrows(ResponseStatusException.class,()->mapping.map(html,
                List.of(field("same",List.of("t0_r0_c1"),""),field("same",List.of("t0_r1_c1"),"")),"X"));
        assertThrows(ResponseStatusException.class,()->mapping.map(html,
                List.of(field("x",List.of("t999_r0_c0"),"")),"X"));
        assertThrows(ResponseStatusException.class,()->mapping.map(html,
                List.of(field("x",List.of(),"")),"X"));
        assertThrows(ResponseStatusException.class,()->mapping.map(html,
                List.of(field("x",List.of("t0_r0_c1"),"{{x}} {{unknown}}")),"X"));
    }
    @Test void rejectsTwoDifferentFieldsWritingOneCell() throws Exception {
        String html=source();
        assertThrows(ResponseStatusException.class,()->mapping.map(html,List.of(
                field("x",List.of("t0_r0_c1"),""),field("y",List.of("t0_r0_c1"),"")),"X"));
    }
    @Test void renderingEscapesHtmlAndDoesNotRecursivelyReplaceValues() {
        String rendered=mapping.renderValues("<p>{{x}}</p><p>{{y}}</p>",
                Map.of("x","<script>x</script>\n{{y}}","y","SAFE"));
        assertFalse(rendered.contains("<script>"));
        assertTrue(rendered.contains("&lt;script&gt;"));
        assertTrue(rendered.contains("<br/>{{y}}"));
        assertTrue(rendered.endsWith("<p>SAFE</p>"));
    }
}
