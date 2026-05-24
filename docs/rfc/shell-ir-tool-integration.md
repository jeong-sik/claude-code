# RFC: Shell IR 기반 ShellCommandTool — claude-code BashTool 대체

## Status: Draft

## 목표

claude-code의 `BashTool`을 Shell IR (`Masc_exec.Shell_ir.t`) 기반으로 대체하여
Bash 레벨보다 상위의 typed, risk-classified 고급 도구를 만든다.

## 배경: 현재 BashTool의 한계

| 항목 | 현재 BashTool | 목표 ShellCommandTool |
|------|--------------|----------------------|
| 입력 | raw string `command` | raw string -> `Shell_ir.t` (typed AST) |
| 파싱 | regex + tree-sitter (parallel, fragile) | 단일 entry point `parse_string_to_ir` |
| risk 분류 | 25+ 개별 validator + heuristic | `Shell_ir_risk.classify` (R0/R1/R2) |
| `isReadOnly` | `checkReadOnlyConstraints` (regex 기반) | `risk_class = R0_Read` (type-level) |
| `isDestructive` | 기본 `false` (미구현) | `risk_class = R2_Irreversible` (type-level) |
| 보안 검증 | `bashSecurity.ts` ~2600줄, 25+ validators | `parse_string_to_ir` + `classify` (SSOT) |
| 권한 체크 | exact/prefix/wildcard rules | risk class 기반 typed gate |
| 출력 | raw stdout/stderr | structured (stage words, exit classification) |

## 접근법: 하이브리드 (JSON-RPC + TS 타입)

TS로 Shell IR을 재구현하면 OCaml의 phantom type, GADT 장점을 잃는다.
WASM(js_of_ocaml)은 빌드 파이프라인이 복잡하다.
**JSON-RPC**가 가장 현실적: OCaml 파서를 별도 프로세스로 실행, claude-code가 JSON으로 통신.

## 타입 설계

### Shell IR JSON 표현 (claude-code 측)

```typescript
export type ShellIrMode = 'strict' | 'coding';

export type RiskClass =
  | 'R0_Read'
  | 'R1_Reversible_mutation'
  | 'R2_Irreversible'
  | 'Destructive_protected';

export interface ShellIrSimple {
  kind: 'simple';
  stage_words: string[];
}

export interface ShellIrPipeline {
  kind: 'pipeline';
  stages: ShellIrSimple[];
}

export type ShellIr = ShellIrSimple | ShellIrPipeline;

export interface ShellIrParseResult {
  ir: ShellIr;
  risk_class: RiskClass;
  is_read_operation: boolean;
  is_destructive: boolean;
  stage_words: string[];
}

export type ShellIrParseError = {
  reason: string;
  message: string;
};
```

### 입력/출력 스키마

입력: `{ command: string; mode: ShellIrMode; timeout?: number; ... }`
출력: `{ stdout: string; stderr: string; exit_code: number; risk_class: RiskClass; stage_words: string[]; is_read_operation: boolean; is_destructive: boolean; ... }`

## 아키텍처

```
claude-code ShellCommandTool
  -> JSON-RPC -> masc-mcp OCaml 서비스
       -> parse_string_to_ir ~mode
       -> Shell_ir_risk.classify
  <- JSON <- risk_class + ir + stage_words
  -> risk gate (typed permission check)
  -> exec (sandboxed)
  -> structured output
```

## 구현 계획

### Phase 1: masc-mcp 측 JSON API (lib/server/shell_ir_json_api.ml)
- 입력: `{ "command": "...", "mode": "strict" | "coding" }`
- 출력: `{ "ok": true, "ir": {...}, "risk_class": "R0_Read", ... }` 또는 `{ "ok": false, "error": {...} }`

### Phase 2: claude-code 측 파서 브리지 (src/tools/ShellCommandTool/)
- `parser-bridge.ts` — JSON-RPC 클라이언트
- `types.ts` — 타입 정의
- `shellIrGate.ts` — risk class 기반 권한 게이트

### Phase 3: ShellCommandTool 구현
- `ShellCommandTool.tsx` — 도구 구현
- `src/tools.ts` — 레지스트리 등록
- BashTool -> deprecated 마킹

### Phase 4: 테스트 + 마이그레이션
- 단위/통합 테스트
- Parallel deployment -> internal migration -> deprecation -> removal

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| OCaml 서비스 의존성 | fallback: 서비스 불가 시 기존 BashTool로 폭백 |
| IPC 오버헤드 | 파싱 결과 캐싱 (command hash -> result) |
| 타입 불일치 | JSON schema 양쪽 검증 |
| 보안 회귀 | 기존 BashTool과 병렬 실행, A/B 비교 테스트 |

## 참고

- masc-mcp `lib/exec_policy.ml`: `parse_string_to_ir`
- masc-mcp `lib/exec/shell_ir_risk.mli`: `classify`, phantom types
- RFC-0160: Shell IR 1급 승격
