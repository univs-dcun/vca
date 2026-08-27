package ai.univs.vca.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(AdminApiException.class)
	public ResponseEntity<ApiEnvelope> handleAdminApi(AdminApiException e) {
		return ResponseEntity.status(e.status()).body(ApiEnvelope.error(e.code(), e.getMessage()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiEnvelope> handleUnexpected(Exception e) {
		log.error("unhandled admin error", e);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(ApiEnvelope.error("ADM-5000", "internal error"));
	}
}
