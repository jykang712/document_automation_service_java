package com.pickle.backend.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

// 최초 ADMIN 중복 생성과 동시 역할 변경을 직렬화합니다.
// 테이블 추가 없이 MariaDB의 연결 단위 이름 잠금을 사용합니다.
@Component
public class UserMutationExecutor {
    private static final Logger log = LoggerFactory.getLogger(UserMutationExecutor.class);
    private final DataSource dataSource;
    private final TransactionTemplate transaction;

    public UserMutationExecutor(DataSource dataSource, PlatformTransactionManager manager) {
        this.dataSource = dataSource;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public <T> T execute(Supplier<T> action) {
        try (Connection lockConnection = dataSource.getConnection()) {
            String lockName = "pickle.users:" + lockConnection.getCatalog();
            boolean acquired = lock(lockConnection, "SELECT GET_LOCK(?, 10)", lockName) == 1;
            if (!acquired) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "사용자 처리 중입니다. 잠시 후 다시 시도해 주세요.");
            }
            try {
                // execute가 반환될 때 DB 트랜잭션은 이미 commit/rollback 완료입니다.
                return transaction.execute(status -> action.get());
            } finally {
                try {
                    if (lock(lockConnection, "SELECT RELEASE_LOCK(?)", lockName) != 1) {
                        lockConnection.abort(Runnable::run);
                        log.error("사용자 잠금 해제를 확인하지 못해 해당 연결을 종료했습니다.");
                    }
                } catch (SQLException releaseError) {
                    // 잠금을 가진 연결이 커넥션 풀로 반환되지 않도록 실제 연결을 종료합니다.
                    lockConnection.abort(Runnable::run);
                    log.error("사용자 잠금 해제 실패", releaseError);
                }
            }
        } catch (SQLException ex) {
            log.error("사용자 변경 잠금 처리 실패", ex);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "사용자 저장 연결을 확인해 주세요.");
        }
    }

    private int lock(Connection connection, String sql, String name) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, name);
            try (var result = statement.executeQuery()) {
                if (!result.next()) { return 0; }
                int value = result.getInt(1);
                return result.wasNull() ? 0 : value;
            }
        }
    }
}
