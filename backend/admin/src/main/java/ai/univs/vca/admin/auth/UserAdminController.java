package ai.univs.vca.admin.auth;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.auth.AuthDtos.AccessUpdateRequest;
import ai.univs.vca.admin.auth.AuthDtos.AppSearchRequest;
import ai.univs.vca.admin.auth.AuthDtos.CreateUserRequest;
import ai.univs.vca.admin.auth.AuthDtos.ProjectsUpdateRequest;
import ai.univs.vca.admin.auth.AuthDtos.StatusUpdateRequest;
import ai.univs.vca.admin.security.RequiresOwner;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 계정 관리 API (UV-48 → UV-50) — Portal Users & Permissions 화면. 세션 게이트(SessionInterceptor) 뒤:
 * 목록은 콘솔 역할 3종, 접근 권한을 만드는/바꾸는 것(생성·권한·상태·삭제·임시 비밀번호)은 owner 전용.
 * 프록시에 admin 라우트가 없어 VCA 대시보드에서는 접근 불가 — Portal은 /api/portal/users 경유.
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
	@RequiresOwner
	@PostMapping
	public ResponseEntity<ApiEnvelope> create(@RequestBody CreateUserRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiEnvelope.ok(service.create(request)));
	}

	/** 임시 비밀번호 재발급 — 기존 세션 전부 무효화, Set Password 강제 복귀 */
	@RequiresOwner
	@PostMapping("/{userId}/reset-password")
	public ApiEnvelope resetPassword(@PathVariable Long userId) {
		return ApiEnvelope.ok(service.resetPassword(userId));
	}

	@RequiresOwner
	@PutMapping("/{userId}/access")
	public ApiEnvelope updateAccess(@PathVariable Long userId, @RequestBody AccessUpdateRequest req) {
		return ApiEnvelope.ok(service.updateAccess(userId, req.permission(), req.appAccess()));
	}

	@RequiresOwner
	@PutMapping("/{userId}/app-search")
	public ApiEnvelope setAppSearch(@PathVariable Long userId, @RequestBody AppSearchRequest req) {
		return ApiEnvelope.ok(service.setAppSearch(userId, Boolean.TRUE.equals(req.allowed())));
	}

	/** 프로젝트 배정은 설치 설정 — owner|admin */
	@PutMapping("/{userId}/projects")
	public ApiEnvelope updateProjects(@PathVariable Long userId, @RequestBody ProjectsUpdateRequest req) {
		return ApiEnvelope.ok(service.updateProjects(userId, req.projectIds()));
	}

	@RequiresOwner
	@PutMapping("/{userId}/status")
	public ApiEnvelope updateStatus(@PathVariable Long userId, @RequestBody StatusUpdateRequest req) {
		return ApiEnvelope.ok(service.updateStatus(userId, req.status()));
	}

	@RequiresOwner
	@DeleteMapping("/{userId}")
	public ApiEnvelope delete(@PathVariable Long userId) {
		service.delete(userId);
		return ApiEnvelope.ok(null);
	}
}
