package dev.toktab.brainhack.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {
    @GetMapping({
            "/admin",
            "/dashboard",
            "/audit",
            "/audit/**",
            "/history",
            "/login",
            "/register",
            "/messages",
            "/profile",
            "/projects",
            "/projects/**",
            "/{route:[^\\.]+}"
    })
    public String app() {
        return "forward:/index.html";
    }
}
