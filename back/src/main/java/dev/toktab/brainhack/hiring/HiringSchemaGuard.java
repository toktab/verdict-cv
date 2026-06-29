package dev.toktab.brainhack.hiring;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class HiringSchemaGuard implements ApplicationRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    public HiringSchemaGuard(DataSource dataSource, JdbcTemplate jdbcTemplate) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            String product = metaData.getDatabaseProductName().toLowerCase();
            if (!product.contains("mysql") && !product.contains("mariadb")) {
                return;
            }
            widenColumnsIfPresent(connection);
        }
    }

    private void widenColumnsIfPresent(Connection connection) throws SQLException {
        Map<String, String[]> columns = Map.of(
                "hiring_projects", new String[] {"description", "requirements_text"},
                "hiring_candidates", new String[] {"cv_text", "summary", "claims_json", "audit_phrase_matches_json"}
        );
        for (Map.Entry<String, String[]> entry : columns.entrySet()) {
            if (!tableExists(connection, entry.getKey())) {
                continue;
            }
            for (String column : entry.getValue()) {
                if (columnExists(connection, entry.getKey(), column) && !isLongText(connection, entry.getKey(), column)) {
                    jdbcTemplate.execute("ALTER TABLE " + entry.getKey() + " MODIFY " + column + " LONGTEXT NOT NULL");
                }
            }
        }
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (ResultSet result = connection.getMetaData().getTables(connection.getCatalog(), null, table, new String[] {"TABLE"})) {
            return result.next();
        }
    }

    private boolean columnExists(Connection connection, String table, String column) throws SQLException {
        try (ResultSet result = connection.getMetaData().getColumns(connection.getCatalog(), null, table, column)) {
            return result.next();
        }
    }

    private boolean isLongText(Connection connection, String table, String column) throws SQLException {
        String database = connection.getCatalog();
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = ?
                  AND table_name = ?
                  AND column_name = ?
                  AND data_type = 'longtext'
                """,
                Integer.class,
                database,
                table,
                column
        );
        return count != null && count > 0;
    }
}
