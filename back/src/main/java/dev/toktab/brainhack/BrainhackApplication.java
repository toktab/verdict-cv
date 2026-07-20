package dev.toktab.brainhack;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BrainhackApplication {

	public static void main(String[] args) {
		SpringApplication.run(BrainhackApplication.class, args);
	}

}
