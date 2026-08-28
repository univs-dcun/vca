package ai.univs.vca.admin.auth;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.auth.AuthDtos.CreateUserRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 담당자용 계정 발급 API (UV-48) — Admin(portal) 화면이 호출할 그룹. 카메라 CRUD와 마찬가지로
 * VCA 대시보드(프록시)는 이 API를 호출하지 않는다 (프록시에 라우트 없음 — 브라우저 비노출).
 */
@RestController
@RequestMapping("/admin/api/users")
public class UserAdminController {

	private final UserAdminService service;

	public UserAdminController(UserAdminService service) {
		this.service = service;
	}

	@GetMapping
	public ApiEnvelope list() {
		return ApiEnvelope.ok(service.list());
	}

	/** 생성 — 응답의 tempPassword는 이 한 번만 노출된다 */
	@PostMapping
	public ResponseEntity<ApiEnvelope> create(@RequestBody CreateUserRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiEnvelope.ok(service.create(request)));
	}

	/** 임시 비밀번호 재발급 — 기존 세션 전부 무효화, Set Password 강제 복귀 */
	@PostMapping("/{userId}/reset-password")
	public ApiEnvelope resetPassword(@PathVariable Long userId) {
		return ApiEnvelope.ok(service.resetPassword(userId));
	}
}
