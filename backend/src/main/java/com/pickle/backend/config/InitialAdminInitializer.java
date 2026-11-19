package com.pickle.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import com.pickle.backend.service.UserAuthenticationService;

@Component
@ConditionalOnProperty(name = "app.bootstrap-admin.enabled", havingValue = "true")
public class InitialAdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(InitialAdminInitializer.class);
    private final UserAuthenticationService service;
    private final String loginId;
    private final String name;
    private final String password;

    public InitialAdminInitializer(UserAuthenticationService service,
            @Value("${app.bootstrap-admin.login-id:}") String loginId,
            @Value("${app.bootstrap-admin.name:}") String name,
            @Value("${app.bootstrap-admin.password:}") String password) {
        this.service = service;
        this.loginId = loginId;
        this.name = name;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (service.createInitialAdmin(loginId, name, password)) {
            log.info("최초 ADMIN 생성 완료. 초기 관리자 생성 설정을 비활성화하세요.");
        } else {
            log.info("기존 사용자가 있어 최초 ADMIN 생성은 건너뜁니다.");
        }
    }
}
