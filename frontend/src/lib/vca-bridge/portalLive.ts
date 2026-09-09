// Portal 라이브 브릿지 (UV-52, W3) — 기획자 Portal 화면은 Zustand 스토어(features/vca/lib/vcaStore)만 읽고 쓴다.
// 이 모듈은 그 스토어를 Admin 백엔드(프록시 /api/portal/**, admin-api.json 0.10.0)로 채우고(hydrate),
// 변경 액션을 API 호출로 갈아 끼운다(installLiveActions). 화면 코드는 그대로 — "데이터는 store로만" 규칙.
//
// 규칙
//  - 세션이 없거나(401/403) 인증 서버가 없으면 아무것도 하지 않는다 → 화면은 기존 mock 시드로 동작 (개발 폴백)
//  - 목록 7종(팀·프로젝트·카메라·서버·계정·명부·감사)과 집계 2종(일별 검출·카메라 불안정도)을 한 번에 채운다
//    — 프로젝트 id가 mock → 실값으로 바뀌는 그 렌더에 집계도 준비돼 있어야 화면이 두 번 그려지지 않는다
//  - 변경 후에는 관련 목록을 다시 받아 setState — 낙관적 갱신 없음(서버가 원천). 30초 폴링(기획 D1 확정)은
//    카메라 상태·감사 로그·집계만
//  - VIP(persons/groups)·업로드·접근 요청은 서버 계약이 아직 없어(W5/W6, accessRequest=false) mock 그대로
//  - 비밀번호·코드·토큰 원문은 서버 발급 응답에 한 번만 실린다 — 스토어에는 화면이 이번 세션에 보여줄 값만 잠시 둔다
import { useEffect, useRef } from 'react'
import * as api from '../../api/generated/portal/portal'
import type {
  PortalAuditEvent, PortalCamera, PortalCameraRequest, PortalDailyDetections, PortalMailRequest, PortalMailView,
  PortalProject, PortalRosterRow, PortalServer, PortalServerRequest, PortalStabilityRow, PortalTeam,
  PortalUser as ApiPortalUser,
} from '../../api/generated/model'
import {
  useVcaStore,
  type AuditEvent, type Camera, type CameraAiFeature, type CameraStatus, type LiveAggregates, type PortalPermission,
  type PortalUser, type PortalUserStatus, type Project, type ProjectType, type Server, type ServerStatus,
  type ServerType, type SmtpConfig, type Team,
} from '../../features/vca/lib/vcaStore'
import type { RosterEntry } from '../../features/vca/lib/staffRoster'
import { getSessionUser, useSession } from './session'

/** 기획 D1 확정 — Portal은 30초 폴링 + 수동 새로고침 */
export const PORTAL_POLL_MS = 30_000

let live = false
let inflight: Promise<boolean> | null = null
/** 이번 세션에 서버가 발급해 준 명부 코드 원문 — 화면이 "코드 보기"로 다시 보여줄 수 있게 잠시 보관 (재조회 불가) */
const issuedRosterCodes = new Map<string, { code: string; issuedAt: string }>()

export function isPortalLive(): boolean {
  return live
}

// ── 매핑: 서버 DTO → 화면 스토어 타입 ───────────────────────────────────────────

function mailOf(m: PortalMailView | null | undefined): { mailDomain?: string; smtp?: SmtpConfig } {
  if (!m) return {}
  const smtp: SmtpConfig | undefined = m.host
    ? { host: m.host, port: m.port ?? 587, fromAddress: m.fromAddress ?? '', username: m.username ?? undefined, useTls: m.useTls ?? undefined }
    : undefined
  return { mailDomain: m.mailDomain ?? undefined, smtp }
}

function mapTeam(t: PortalTeam): Team {
  return {
    id: t.id, name: t.name, region: t.region ?? '',
    ...mailOf(t.mail),
    accountManager: t.accountManagerName || t.accountManagerEmail
      ? { name: t.accountManagerName ?? '', email: t.accountManagerEmail ?? '' } : undefined,
  }
}

function mapProject(p: PortalProject): Project {
  return {
    id: p.id, teamId: p.teamId, name: p.name, type: p.type as ProjectType, timeZone: p.timeZone,
    licensePlan: p.licensePlan ?? undefined, licenseChannelLimit: p.licenseChannelLimit ?? undefined,
    licenseExpiresAt: p.licenseExpiresAt ?? undefined,
    computeInstance: p.computeInstance ?? undefined, gpuCount: p.gpuCount ?? undefined,
    modelVersion: p.modelVersion ?? undefined, regionName: p.regionName ?? undefined,
    networkIsolatedDetected: p.networkIsolatedDetected, networkIsolatedOverride: p.networkIsolatedOverride ?? null,
    ...mailOf(p.mail),
  }
}

/** 서버 status(online·offline·error·unknown) → 화면 3종. unknown(상태 미수신)은 기획 확정대로 offline에 합친다 */
function cameraStatusOf(s: PortalCamera['status']): CameraStatus {
  return s === 'online' ? 'online' : s === 'error' ? 'error' : 'offline'
}

function mapCamera(c: PortalCamera): Camera {
  return {
    id: c.cameraId, projectId: c.projectId ?? '', code: c.code ?? '', name: c.name,
    ip: c.ip ?? '', mac: c.mac ?? '', rtspUrl: c.rtspUrl, status: cameraStatusOf(c.status),
    lastSeenAt: c.lastSeenAt ?? undefined,
    location: c.location ?? c.locationId, zone: c.zone, thumbnail: c.thumbnail ?? '',
    lat: c.coordinates.lat, lng: c.coordinates.lng,
    aiFeatures: (c.aiFeatures ?? []) as CameraAiFeature[],
    protocol: c.protocol === 'TCP' || c.protocol === 'UDP' ? c.protocol : undefined,
    maker: c.maker ?? undefined, model: c.model ?? undefined, resolution: c.resolution ?? undefined,
    username: c.username ?? undefined, serverId: c.serverId ?? undefined,
  }
}

function mapServer(s: PortalServer): Server {
  return {
    id: s.id, projectId: s.projectId, name: s.name, ip: s.ip, type: s.type as ServerType,
    specification: s.specification ?? undefined,
    status: (s.status === 'success' ? 'success' : 'error') as ServerStatus,
  }
}

function mapUser(u: ApiPortalUser): PortalUser {
  return {
    id: String(u.id), name: u.name, email: u.email ?? '', teamId: u.teamId ?? '',
    projectIds: u.projectIds ?? [], permission: u.permission as PortalPermission,
    appSearch: u.appSearch, appAccess: u.appAccess, status: u.status as PortalUserStatus,
    lastLoginAt: u.lastLoginAt ?? undefined, employeeId: u.employeeId ?? undefined,
    mustChangePassword: u.mustSetPassword,
  }
}

function mapRoster(r: PortalRosterRow): RosterEntry {
  const issued = issuedRosterCodes.get(r.employeeId)
  return {
    employeeId: r.employeeId, projectId: r.projectId, name: r.name,
    department: r.department ?? undefined, email: r.email ?? undefined,
    permission: r.permission, status: r.status,
    issuedAt: r.codeIssuedAt ?? undefined,
    // 원문은 서버에 없다(해시만). 이번 세션에 발급한 코드만 다시 보여줄 수 있다 — 발급 시각이 같을 때만
    code: issued && issued.issuedAt === r.codeIssuedAt ? issued.code : undefined,
  }
}

function mapAudit(a: PortalAuditEvent): AuditEvent {
  return { id: String(a.id), projectId: a.projectId ?? undefined, message: a.message, actor: a.actor, at: a.at }
}

function stabilityOf(rows: PortalStabilityRow[]): LiveAggregates['stability'] {
  return rows.map((r) => ({ cameraId: r.cameraId, drops: r.drops, dropsByDay: r.dropsByDay }))
}

function dailyOf(rows: PortalDailyDetections[]): LiveAggregates['daily'] {
  return rows.map((r) => ({ daysAgo: r.daysAgo, total: r.total, vip: r.vip, vehicle: r.vehicle, unknown: r.unknown }))
}

// ── 조회 ─────────────────────────────────────────────────────────────────────

async function fetchAggregates(projectIds: string[]): Promise<Record<string, LiveAggregates>> {
  const out: Record<string, LiveAggregates> = {}
  await Promise.all(projectIds.map(async (id) => {
    const [daily, stability] = await Promise.all([
      api.portalDailyDetections(id, { days: 14 }).then((r) => dailyOf(r.data)).catch(() => undefined),
      api.portalCameraStability(id, { days: 7, limit: 200 }).then((r) => stabilityOf(r.data)).catch(() => undefined),
    ])
    out[id] = { daily, stability }
  }))
  return out
}

async function refreshCameras(): Promise<void> {
  const res = await api.portalListCameras()
  useVcaStore.setState({ cameras: res.data.map(mapCamera) })
}
async function refreshServers(): Promise<void> {
  const res = await api.portalListServers()
  useVcaStore.setState({ servers: res.data.map(mapServer) })
}
async function refreshProjects(): Promise<void> {
  const res = await api.portalListProjects()
  useVcaStore.setState({ projects: res.data.map(mapProject) })
}
async function refreshTeams(): Promise<void> {
  const res = await api.portalListTeams()
  useVcaStore.setState({ teams: res.data.map(mapTeam) })
}
async function refreshUsers(): Promise<void> {
  const res = await api.portalListUsers()
  useVcaStore.setState({ portalUsers: res.data.map(mapUser) })
}
async function refreshRoster(): Promise<void> {
  const res = await api.portalListRoster()
  useVcaStore.setState({ staffRoster: res.data.map(mapRoster) })
}
async function refreshAudit(): Promise<void> {
  const res = await api.portalListAudit({ limit: 200 })
  useVcaStore.setState({ auditLog: res.data.map(mapAudit) })
}
async function refreshAggregates(): Promise<void> {
  const ids = useVcaStore.getState().projects.map((p) => p.id)
  useVcaStore.setState({ liveAggregates: await fetchAggregates(ids) })
}

/** 변경 뒤 재조회 — 감사 로그는 모든 변경이 남기므로 함께 */
async function after(...refreshers: Array<() => Promise<void>>): Promise<void> {
  await Promise.all([...refreshers.map((r) => r().catch(swallow)), refreshAudit().catch(swallow)])
}
function swallow(e: unknown): void {
  console.warn('[portal-live] refresh failed', e)
}

/**
 * 전체 채우기. 세션이 없거나(401/403 — 앱 전용 계정) 서버가 없으면 false를 돌려주고 스토어는 건드리지 않는다.
 * 동시 호출은 한 번만 실행한다.
 */
export function hydratePortal(): Promise<boolean> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      if (!getSessionUser() || getSessionUser()?.permission === 'none') return false
      const [teams, projects, cameras, servers, users, roster, audit] = await Promise.all([
        api.portalListTeams(), api.portalListProjects(), api.portalListCameras(), api.portalListServers(),
        api.portalListUsers(), api.portalListRoster(), api.portalListAudit({ limit: 200 }),
      ])
      const projectRows = projects.data.map(mapProject)
      const liveAggregates = await fetchAggregates(projectRows.map((p) => p.id))
      useVcaStore.setState({
        teams: teams.data.map(mapTeam),
        projects: projectRows,
        cameras: cameras.data.map(mapCamera),
        servers: servers.data.map(mapServer),
        portalUsers: users.data.map(mapUser),
        staffRoster: roster.data.map(mapRoster),
        auditLog: audit.data.map(mapAudit),
        liveAggregates,
      })
      if (!live) {
        live = true
        installLiveActions()
      }
      return true
    } catch (e) {
      console.info('[portal-live] Admin API 미응답/권한 없음 — mock 유지', (e as { response?: { status?: number } }).response?.status ?? e)
      return false
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 폴링 대상만 (기획 D1: 카메라 상태·감사·집계) */
export async function pollPortal(): Promise<void> {
  if (!live) return
  await Promise.all([refreshCameras().catch(swallow), refreshAudit().catch(swallow), refreshAggregates().catch(swallow)])
}

// ── 변경 액션 교체 ─────────────────────────────────────────────────────────────

function cameraRequestOf(c: Omit<Camera, 'id'> & Partial<Pick<Camera, 'id'>>, password?: string): PortalCameraRequest {
  return {
    projectId: c.projectId || undefined, code: c.code || undefined, name: c.name,
    ip: c.ip || undefined, mac: c.mac || undefined, maker: c.maker, model: c.model, resolution: c.resolution,
    protocol: c.protocol, username: c.username, password,
    rtspUrl: c.rtspUrl, zone: c.zone, location: c.location || undefined,
    coordinates: { lat: c.lat, lng: c.lng }, serverId: c.serverId,
    aiFeatures: c.aiFeatures as PortalCameraRequest['aiFeatures'], thumbnail: c.thumbnail || undefined,
  }
}

function serverRequestOf(s: Omit<Server, 'id'>): PortalServerRequest {
  return { projectId: s.projectId, name: s.name, ip: s.ip, type: s.type, specification: s.specification }
}

function mailRequestOf(u: { mailDomain?: string; smtp?: SmtpConfig }): PortalMailRequest {
  return {
    mailDomain: u.mailDomain ?? null,
    host: u.smtp?.host ?? null, port: u.smtp?.port ?? null, fromAddress: u.smtp?.fromAddress ?? null,
    username: u.smtp?.username ?? null, useTls: u.smtp?.useTls ?? null,
    // password 필드는 화면 SmtpConfig에 없다 — 생략하면 서버가 기존 암호문을 유지한다(쓰기 전용)
  }
}

function num(id: string): number {
  const n = Number(id)
  if (!Number.isFinite(n)) throw new Error(`live portal user id expected, got ${id}`)
  return n
}

/** 스토어의 변경 액션을 API 호출 + 재조회로 바꾼다. 화면 호출부는 그대로 */
function installLiveActions(): void {
  useVcaStore.setState({
    // 카메라 (UV-53) — status는 서버(MQTT 적재)가 원천이라 setCameraStatus는 재조회로만 답한다
    setCameraStatus: () => { void refreshCameras().catch(swallow) },
    addCamera: (camera) => { void api.portalCreateCamera(cameraRequestOf(camera)).then(() => after(refreshCameras, refreshProjects)) },
    updateCamera: (cameraId, updates) => {
      const cur = useVcaStore.getState().cameras.find((c) => c.id === cameraId)
      if (!cur) return
      void api.portalUpdateCamera(cameraId, cameraRequestOf({ ...cur, ...updates })).then(() => after(refreshCameras))
    },
    removeCamera: (cameraId) => { void api.portalDeleteCamera(cameraId).then(() => after(refreshCameras, refreshProjects)) },
    removeCameras: (cameraIds) => { void api.portalDeleteCameras({ cameraIds }).then(() => after(refreshCameras, refreshProjects)) },
    setCamerasZone: (cameraIds, zone) => { void api.portalSetCamerasZone({ cameraIds, zone }).then(() => after(refreshCameras)) },

    // 프로젝트·팀 (UV-50/53)
    addProject: async (project) => {
      const res = await api.portalCreateProject({ teamId: project.teamId, name: project.name, type: project.type, timeZone: project.timeZone })
      await after(refreshProjects)
      return res.data.id
    },
    updateProjectLicense: (projectId, updates) => {
      void api.portalUpdateLicense(projectId, { plan: updates.licensePlan ?? null, channelLimit: updates.licenseChannelLimit ?? null, expiresAt: updates.licenseExpiresAt ?? null })
        .then(() => after(refreshProjects))
    },
    updateProjectMail: (projectId, updates) => { void api.portalUpdateProjectMail(projectId, mailRequestOf(updates)).then(() => after(refreshProjects)) },
    setProjectTimeZone: (projectId, timeZone) => { void api.portalUpdateTimeZone(projectId, { timeZone }).then(() => after(refreshProjects)) },
    setNetworkIsolationOverride: (projectId, override) => { void api.portalUpdateNetworkIsolation(projectId, { override }).then(() => after(refreshProjects)) },
    updateTeamMail: (teamId, updates) => { void api.portalUpdateTeamMail(teamId, mailRequestOf(updates)).then(() => after(refreshTeams)) },
    addTeam: async (team) => {
      const res = await api.portalCreateTeam({ name: team.name, region: team.region || null })
      await after(refreshTeams)
      return res.data.id
    },

    // 계정 (UV-47/50/51) — 임시 비밀번호·셋업 코드·초대 토큰 원문은 서버 발급 응답에 한 번만
    addPortalUser: async (user) => {
      const res = await api.portalCreateUser({
        name: user.name, email: user.email || null, employeeId: user.employeeId || null, teamId: user.teamId || null,
        projectIds: user.projectIds, permission: user.permission, appAccess: user.appAccess, appSearch: user.appSearch ?? false,
      })
      await after(refreshUsers)
      return String(res.data.id)
    },
    updatePortalUserPermission: (userId, permission) => { void api.portalUpdateUserAccess(num(userId), { permission }).then(() => after(refreshUsers)) },
    updatePortalUserAccess: (userId, permission, appAccess) => { void api.portalUpdateUserAccess(num(userId), { permission, appAccess }).then(() => after(refreshUsers)) },
    setAppSearch: (userId, allowed) => { void api.portalSetUserAppSearch(num(userId), { allowed }).then(() => after(refreshUsers)) },
    updatePortalUserProjects: (userId, projectIds) => { void api.portalUpdateUserProjects(num(userId), { projectIds }).then(() => after(refreshUsers)) },
    updatePortalUserStatus: (userId, status) => { void api.portalUpdateUserStatus(num(userId), { status }).then(() => after(refreshUsers)) },
    removePortalUser: (userId) => { void api.portalDeleteUser(num(userId)).then(() => after(refreshUsers)) },
    issueTemporaryPassword: async (userId) => {
      const res = await api.portalResetUserPassword(num(userId))
      await after(refreshUsers)
      return res.data.tempPassword
    },
    clearTemporaryPassword: () => { /* 서버가 Set Password 완료 시 해제 — 화면 쪽 흔적 없음 */ },
    issueInviteToken: async (userId) => {
      const res = await api.portalIssueInviteToken(num(userId))
      await after(refreshUsers)
      return res.data.token
    },
    issueSetupCode: async (userId) => {
      const res = await api.portalIssueSetupCode(num(userId))
      await after(refreshUsers)
      return res.data.codeFormatted
    },
    clearSetupCode: () => { /* 서버가 활성화 시 소진 */ },

    // 서버 레지스트리 (UV-53)
    addServer: (server) => { void api.portalCreateServer(serverRequestOf(server)).then(() => after(refreshServers)) },
    updateServer: (serverId, updates) => {
      const cur = useVcaStore.getState().servers.find((s) => s.id === serverId)
      if (!cur) return
      void api.portalUpdateServer(serverId, serverRequestOf({ ...cur, ...updates })).then(() => after(refreshServers))
    },
    removeServer: (serverId) => { void api.portalDeleteServer(serverId).then(() => after(refreshServers)) },

    // 명부·등록 코드 (UV-51) — 코드 원문은 발급 응답 1회, 이번 세션에만 다시 보여준다
    addRosterEntry: async (entry) => {
      const res = await api.portalAddRoster({
        projectId: entry.projectId,
        entries: [{ employeeId: entry.employeeId, name: entry.name, department: entry.department ?? null, email: entry.email ?? null, permission: entry.permission }],
      })
      await after(refreshRoster)
      return (res.data.rows[0]?.ok ?? false)
    },
    updateRosterEntry: (employeeId, updates) => {
      const cur = useVcaStore.getState().staffRoster.find((r) => r.employeeId === employeeId)
      if (!cur) return
      const m = { ...cur, ...updates }
      void api.portalUpdateRosterEntry(employeeId, { employeeId, name: m.name, department: m.department ?? null, email: m.email ?? null, permission: m.permission })
        .then(() => after(refreshRoster))
    },
    issueRegistrationCodes: (employeeIds) => {
      void api.portalIssueRosterCodes({ employeeIds }).then((res) => {
        res.data.forEach((c) => issuedRosterCodes.set(c.employeeId, { code: c.code, issuedAt: c.issuedAt }))
        return after(refreshRoster)
      })
    },
    reissueRegistrationCode: (employeeId) => {
      void api.portalReissueRosterCode(employeeId).then((res) => {
        issuedRosterCodes.set(res.data.employeeId, { code: res.data.code, issuedAt: res.data.issuedAt })
        return after(refreshRoster)
      })
    },
    removeRosterEntry: (employeeId) => { void api.portalDeleteRosterEntry(employeeId).then(() => after(refreshRoster)) },
    logRosterCodeViewed: () => { /* 서버 감사 대상 아님(코드는 재조회 불가) */ },
  })
}

// ── 훅 ───────────────────────────────────────────────────────────────────────

/**
 * PortalShell(및 앱 ClientLayout)에 한 줄 주입 — 세션이 확정되면 채우고, Portal 안에서는 30초 폴링.
 * 앱 전용 계정·서버 미가동이면 조용히 mock 유지.
 */
export function usePortalLive(options: { poll?: boolean } = {}): void {
  const poll = options.poll ?? true
  // 세션 스냅샷을 구독 — 화면이 먼저 그려지고 /auth/me가 나중에 확정돼도 그때 채운다
  const session = useSession()
  const user = session.status === 'ok' ? session.user : null
  const key = user ? `${user.id}:${user.permission}` : ''
  const started = useRef<string | null>(null)
  useEffect(() => {
    if (!key || started.current === key) return
    started.current = key
    void hydratePortal()
  }, [key])
  useEffect(() => {
    if (!poll) return
    const timer = window.setInterval(() => { void pollPortal() }, PORTAL_POLL_MS)
    return () => window.clearInterval(timer)
  }, [poll])
}
