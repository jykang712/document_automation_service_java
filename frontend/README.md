# Java 백엔드용 React 프론트

첨부한 기존 React 화면 구조를 참고해 Spring Boot/Tomcat API에 맞춘 Vite 프로젝트입니다.
Python용 원본 8개 파일은 reference-python-ui/에 보관했습니다. 실행 코드는 src/입니다.
기존 백엔드 소스와 DB는 이 패키지로 수정하지 않습니다.

## 실행 위치
Windows에서 압축을 풀어 다음과 같이 배치하세요. frontend 폴더 바로 안에 package.json이 있어야 합니다.

D:\workspace_java21\backend  : 기존 Eclipse/Java 프로젝트
D:\workspace_java21\frontend : 이 프론트 프로젝트

Node.js 22.12 이상이 필요합니다. Node 24도 사용할 수 있습니다.

```powershell
node --version
npm --version
cd D:\workspace_java21\frontend
npm ci
npm run dev
```

먼저 Eclipse에서 Tomcat과 backend 애플리케이션을 실행하세요.
브라우저에서 http://localhost:5173 으로 접속합니다.
PowerShell에서 로그인했어도 브라우저에서는 별도로 로그인해야 합니다.
admin@example.com / user@example.com과 본인이 설정한 비밀번호를 사용합니다.
Node 설정 변경 후에는 PowerShell 창을 새로 열어 버전을 확인하세요.

이 프로젝트는 npm create vite로 다시 생성하지 않고 바로 npm ci로 설치합니다.
package-lock.json으로 실제 확인한 버전을 고정했습니다.

## 연결 구조
브라우저 /api/... → Vite 프록시 → http://localhost:8080/backend/api/...
브라우저의 로그인 쿠키와 CSRF는 api.js에서 처리합니다.
로그인 전 CSRF 발급 → 로그인 → 로그인 후 CSRF 재발급 순서를 사용합니다.
모든 등록/수정/삭제 및 multipart 업로드에 해당 세션의 CSRF 헤더를 넣습니다.
FormData 업로드는 브라우저가 Content-Type/boundary를 설정합니다.
204 응답은 JSON으로 파싱하지 않습니다.

Tomcat의 /backend 세션 쿠키가 /api 프록시에서도 전송되도록
vite.config.js에 cookiePathRewrite='/'를 적용했습니다.
/api 요청의 backend 컨텍스트도 /backend로 변환합니다.

기본값을 사용하면 .env를 만들 필요가 없습니다.
주소/컨텍스트가 다를 때만 .env.example을 .env로 복사하고 수정합니다.

BACKEND_ORIGIN=http://localhost:8080
BACKEND_CONTEXT=/backend
VITE_API_BASE=/api

.env 변경 후 Vite를 재시작하세요.
Java의 CORS 허용 목록에는 http://localhost:5173, http://127.0.0.1:5173가 있어야 합니다.
앞서 제공한 SecurityConfig에는 두 주소가 포함되어 있습니다.

## 지원하는 화면
| 화면 | 연결 기능 | 권한 |
| --- | --- | --- |
| 로그인 | 세션 로그인/로그아웃, 새로고침 후 내 정보 조회 | USER/ADMIN |
| 문서 관리 | 목록/검색/상세, 제목·HTML 수정, 비활성화, HTML 다운로드 | 서버 소유권 정책 적용 |
| 문서 작성 | 활성 양식 선택, 필드 직접 입력, HTML 미리보기, 본인 소유 저장 | USER/ADMIN |
| 양식 관리 | DOCX 업로드/셀 매핑/JSON 저장/조회, 양식명·설명 수정, 비활성화 | ADMIN |
| 조직원 관리 | 수동 등록·목록 | ADMIN |
| 결재 규칙 | 준비 중 안내 | ADMIN |

조직원의 수정/삭제, 결재 규칙 CRUD, 이미지/PDF AI 분석, 자동작성/이메일 API는
현재 확인된 Java 구현에 포함되어 있지 않아 이번 실행 화면에서는 호출하지 않습니다.
관련 Python용 기존 화면은 reference-python-ui/에서 이후 포팅할 때 참고할 수 있습니다.
프론트에서 메뉴를 숨기는 것과 별개로 서버가 실제 권한을 검사합니다.
역할을 변경한 경우 권한 새로고침 버튼으로 화면 메뉴를 즉시 갱신할 수 있습니다.

문서 작성은 AI를 호출하지 않고 입력값을 텍스트로 안전하게 양식에 채웁니다.
현재 생성 API의 계약대로 html_content를 보내 저장하며 extracted_json은 기존 서버 기본값 {}입니다.
클라이언트 필수값 검사는 편의를 위한 검사이며 서버의 JSON Schema 검증을 추가한 것은 아닙니다.

## 첨부 파일에서 바뀐 부분
- api.js: Python 8000 경로를 Java 프록시로 변경, 인증 쿠키/CSRF/204/오류 처리 추가.
- App.jsx: 누락된 EducationGenerator 의존 제거, 로그인 화면과 역할별 메뉴 추가.
- TemplateManager.jsx: 기존 필드 편집 UI를 재사용하고 DOCX 수동 매핑/저장에 연결.
  preview-fields → preview-docx, save-with-fields → save-docx,
  multipart 파일 이름 template → file, source_sha256 전달,
  cells → cell_texts, template_fields → fields 응답 차이를 반영.
- ManagePage.jsx: 기존 문서 관리 화면을 재사용하고 서버 비활성화 정책/제목 수정에 맞게 보완.
- ProcessPage.jsx: 활성 양식을 선택하고 직접 값을 입력하는 문서 작성 화면.
- OrgPage.jsx: 현재 Java에 연결 가능한 수동 등록/조회 화면.
- RulePage.jsx: Java 결재규칙 API 구현 후 연결할 안내 화면.
- main.jsx: 기존 진입점 유지, index.css: 기존 유틸리티 클래스에 필요한 Tailwind 포함.
- EditableHtmlPreview.jsx: 원본에서 누락된 미리보기/HTML 편집 컴포넌트 추가.

## DOCX 양식 검증
선행 백엔드: template-management-api.zip + docx-template-import.zip 적용.
추가했던 poi-ooxml/jsoup 의존성과 multipart 크기 설정이 있어야 합니다.

1. 브라우저에서 ADMIN 로그인 → 양식 관리.
2. 양식 이름과 DOCX 선택 → DOCX 미리보기.
3. 오른쪽 +추가 → 라벨, key, 타입, 필수 여부 입력.
4. 해당 필드의 셀 선택을 누르고 가운데 원본 미리보기의 입력 셀을 클릭.
5. 같은 key를 여러 위치에 쓰려면 다중추가 ON 후 셀들을 클릭.
6. 날짜처럼 한 셀에 여러 값이 있으면 셀 템플릿 사용.
   예: {{year}}년 {{month}}월 {{day}}일
   year/month/day 필드를 각각 만들고 year 필드에 셀을 연결한 뒤 셀 템플릿을 입력.
7. 매핑 결과 확인으로 placeholder 위치 확인.
8. DB에 양식 저장 → 실제 저장 결과 모달과 JSON 매핑 확인.

등록을 누르면 document_templates에 1행이 생성됩니다. 미리보기만으로는 저장하지 않습니다.
저장 완료한 가져오기 상태에서는 중복 저장 버튼을 막습니다. 새 파일은 새로 시작으로 진행하세요.
파일을 바꾸면 이전 미리보기·매핑·SHA는 초기화됩니다.
양식명/설명 수정은 기존 행을 변경하고, 비활성화는 is_active=false입니다.
선택한 셀의 기존 내용은 placeholder로 교체됩니다. 라벨 셀이 아닌 입력 칸을 선택하세요.
이미지/도형/원본 페이지 배치 한계는 백엔드 변환 warnings를 확인하세요.

## 문서 검증
1. USER로 로그인 → 문서 작성 → 활성 양식 선택.
2. 제목과 필드 값 입력 후 문서 저장.
3. 문서 관리에서 본인 문서 확인 → 상세 → 편집 → 제목/HTML 변경 → 저장.
4. 비활성화 후 USER 목록에서 사라지는지 확인.
5. ADMIN으로 로그인하면 다른 소유자와 비활성 문서도 목록에 표시되는지 확인.
ADMIN이 문서를 비활성화해도 전체 목록에는 비활성 상태로 남는 것이 정상입니다.
양식이 비활성화돼도 기존 생성 문서는 별도 상태를 유지합니다.

## 미리보기
HTML은 DOMPurify로 정제하고 sandbox iframe에 표시합니다.
원본 HTML의 script/이벤트 속성을 제거하고 별도 iframe에서 셀 선택 이벤트만 전달합니다.
iframe은 allow-same-origin을 사용하지 않으며 외부 리소스 로드를 CSP로 제한합니다.
HTML 다운로드에도 정제를 적용합니다. 비밀번호와 세션 토큰은 localStorage에 저장하지 않습니다.

## 빌드
```powershell
npm run build
```

성공하면 dist/가 생성됩니다. 이번 구성은 Vite 개발 서버로 검증하는 구성입니다.
운영 배포에는 프론트 경로/프록시/정적 파일 권한 설정을 별도로 적용해야 합니다.

## 오류 확인
- Failed to fetch / 서버 연결 오류: Tomcat 시작과 /backend 배포 확인.
- 401: 브라우저에서 다시 로그인.
- 403: 로그인 역할, Java CORS 허용 주소, CSRF 발급 응답 확인.
- 409: 미리보기 후 다른 파일로 변경했는지 확인하고 미리보기 재실행.
- 413: Java multipart max-file-size/max-request-size 설정과 업로드 크기 확인.
- DOCX 셀 클릭: 원본 셀 선택 모드에서 필드의 셀 선택을 켜고 클릭.
- Vite 포트 사용 중: 기존 npm run dev 프로세스를 Ctrl+C로 종료하고 재실행.

## 수행한 확인
npm ci에 사용할 잠금 파일을 생성하고 npm run build 성공을 확인했습니다.
Chromium 브라우저와 Java API 계약을 재현한 로컬 테스트 서버로 다음 흐름을 확인했습니다.
- 로그인 전/후 CSRF, /backend 쿠키 경로 프록시, 브라우저 새로고침 후 로그인 유지
- DOCX multipart 파일/boundary/source_sha256 전달, iframe 셀 클릭, 매핑 JSON 저장 요청
- 미리보기 스크립트 제거/iframe 격리
- USER 메뉴 제한, 문서 생성/제목·본문 수정/비활성화
- ADMIN 비활성 문서 목록과 양식 비활성화
이 검사는 실제 사용자 Tomcat/MariaDB나 Java DOCX 변환을 실행한 통합 검사가 아닙니다.
사용자 환경에서 실제 sample-approval.docx와 실제 업무 DOCX로 한 번 더 확인해야 합니다.
