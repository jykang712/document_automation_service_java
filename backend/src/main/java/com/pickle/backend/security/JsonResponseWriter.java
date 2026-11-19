package com.pickle.backend.security;

import java.io.IOException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class JsonResponseWriter {
    private final ObjectMapper mapper;
    public JsonResponseWriter(ObjectMapper mapper) { this.mapper = mapper; }

    public void write(HttpServletResponse response, int status, Object body) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write(mapper.writeValueAsString(body));
    }
}
