package dev.toktab.brainhack.config;

import dev.toktab.brainhack.admin.AdminAuthFilter;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            RateLimitFilter rateLimitFilter,
            UserAuthPresenceFilter userAuthPresenceFilter,
            AdminAuthFilter adminAuthFilter,
            CorsConfigurationSource corsConfigurationSource,
            @Value("${verdict.security.require-https:false}") boolean requireHttps) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/cli/login",
                                "/api/auth/cli/pair",
                                "/api/auth/register",
                                "/api/auth/refresh",
                                "/api/admin/login",
                                "/api/admin/**",
                                "/api/docs/**",
                                "/api/docs",
                                "/api/docs/ui/**",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/api/system/health",
                                "/api/system/cli/**",
                                "/api/telemetry",
                                "/",
                                "/index.html",
                                "/assets/**",
                                "/favicon.svg")
                        .permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(userAuthPresenceFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(adminAuthFilter, UsernamePasswordAuthenticationFilter.class);
        if (requireHttps) {
            http.requiresChannel(channel -> channel.anyRequest().requiresSecure());
        }
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${verdict.security.allowed-origins:http://localhost:5173,http://localhost:8080}") String allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        List.of(allowedOrigins.split(",")).stream()
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .forEach(config::addAllowedOrigin);
        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
