package dev.toktab.brainhack.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {
    @GetMapping({"/admin", "/audit", "/history"})
    public String app() {
        return "forward:/index.html";
    }
}
