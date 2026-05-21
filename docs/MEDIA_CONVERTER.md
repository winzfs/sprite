# 미디어 변환 기능 개발 문서

## 1. 목적

스프라이트 편집기와 같은 정적 웹앱 안에서 영상/GIF 변환 기능을 제공한다.

현재 목표는 다음과 같다.

- 기존 스프라이트 편집 기능을 유지한다.
- 왼쪽 접이식 네비게이션으로 도구를 기능별로 전환한다.
- 영상 파일을 GIF로 변환한다.
- GIF 파일을 WebM 영상으로 변환한다.
- 모든 처리는 브라우저 로컬에서 수행한다.
- 서버 업로드 없이 동작한다.
- GIF 인코더는 CDN이 아닌 저장소 로컬 파일을 사용한다.

## 2. 현재 지원 범위

### 영상 → GIF

입력 후보:

- MP4
- WebM
- Ogg video
- 일부 MOV
- 기타 브라우저가 `<video>`로 디코딩할 수 있는 영상

주의:

- 실제 지원 여부는 브라우저와 코덱에 따라 다르다.
- MP4라도 H.264/AAC 조합이 아니면 일부 브라우저에서 안 열릴 수 있다.
- MOV는 브라우저와 코덱에 따라 지원 편차가 크다.

출력:

- GIF

현재 구현:

- `<video>`로 로컬 파일을 로드한다.
- `currentTime` seek으로 프레임을 추출한다.
- Canvas에 프레임을 그린다.
- `src/vendor/gif.js` 로컬 GIF 인코더로 GIF를 생성한다.

### GIF 인코더

현재 GIF 인코더는 외부 CDN이 아니라 저장소 내 로컬 파일이다.

```text
src/vendor/gif.js
src/vendor/gif.worker.js
```

`src/vendor/gif.js`는 `gif.js` 호환 일부 API를 제공한다.

지원 API:

```text
new GIF({ width, height, repeat, quality })
gif.addFrame(ctx, { delay })
gif.on('finished', callback)
gif.on('abort', callback)
gif.render()
```

현재 인코딩 방식:

- 프레임 전체 색상 샘플링
- Median-cut 기반 적응형 전역 팔레트 생성
- 256색 팔레트 자동 구성
- 투명 픽셀용 팔레트 인덱스 예약
- 가장 가까운 팔레트 색상으로 매핑
- LZW 압축으로 GIF 작성

품질 옵션:

```text
낮은 값 = 더 많은 색상 샘플링 = 더 좋은 품질 = 느림
높은 값 = 더 적은 색상 샘플링 = 빠름 = 낮은 품질
```

권장값:

```text
고품질: 1~4
균형: 5~8
빠름: 10~20
```

주의:

- 워커 기반 병렬 인코딩은 아직 사용하지 않는다.
- `src/vendor/gif.worker.js`는 경로 호환용 placeholder다.
- 완전한 상용 GIF 인코더 수준의 디더링/프레임 최적화는 아직 없다.
- 필요하면 향후 NeuQuant, Octree, dithering, frame-diff 최적화를 추가한다.

### GIF → 영상

입력:

- GIF

출력:

- WebM

현재 구현:

- `<img>`로 GIF를 로드한다.
- Canvas에 GIF 표시 상태를 주기적으로 그린다.
- `canvas.captureStream()`과 `MediaRecorder`로 WebM을 기록한다.

주의:

- 이 방식은 GIF의 실제 프레임 delay/disposal을 정밀 디코딩하는 방식이 아니다.
- 브라우저가 렌더링 중인 GIF를 캡처하는 실용적 1차 구현이다.
- 정밀한 GIF 디코딩이 필요하면 `gifuct-js` 기반 합성 렌더러를 추가한다.

## 3. 파일 구조

```text
index.html
styles.css
tool-shell.css
src/
├─ app.js
├─ grid-layout.js
├─ ui-shell.js
├─ media-converter.js
└─ vendor/
   ├─ gif.js
   └─ gif.worker.js
```

### `index.html`

- 기존 스프라이트 편집기 뷰를 유지한다.
- 미디어 변환 뷰를 별도 섹션으로 가진다.
- 왼쪽 사이드바는 `details/summary` 기반 접이식 그룹으로 구성한다.
- 현재 그룹:
  - 스프라이트 도구
  - 미디어 변환

### `tool-shell.css`

- 왼쪽 사이드바
- 접이식 네비게이션 그룹
- 도구 화면 전환 레이아웃
- 미디어 변환 화면 스타일
- 모바일 사이드바 대응

### `src/ui-shell.js`

- 왼쪽 메뉴 버튼 클릭 처리
- `data-view` 기준 도구 화면 표시/숨김 처리
- 현재 `index.html`에서 접이식 메뉴 마크업을 직접 제공하므로, 화면 전환만 담당한다.

### `src/media-converter.js`

- 영상 → GIF 변환
- GIF → WebM 변환
- 로컬 파일 URL 관리
- 진행률, 다운로드 링크 관리

### `src/vendor/gif.js`

- 외부 CDN 없이 동작하는 로컬 GIF 인코더
- `window.GIF`를 제공한다.
- `media-converter.js`에서 사용한다.

### `src/vendor/gif.worker.js`

- 경로 호환용 placeholder
- 현재 로컬 인코더는 worker를 사용하지 않는다.

## 4. 개발 원칙

- 기존 스프라이트 편집 기능을 삭제하지 않는다.
- `src/app.js`의 기존 버튼 ID와 이벤트 연결을 깨지 않는다.
- 변환 기능은 별도 파일에서 관리한다.
- 브라우저 표준 API 위주로 구현한다.
- 서버 업로드를 추가하지 않는다.
- 변환 중에는 버튼을 비활성화해서 중복 실행을 막는다.
- 모바일에서는 낮은 해상도와 낮은 FPS 기본값을 사용한다.
- 사이드바 메뉴는 기능별 그룹으로 정리하고 접기/펼치기를 지원한다.
- CDN 의존을 추가하기 전에 로컬 파일 방식이 가능한지 먼저 검토한다.

## 5. 지원 포맷 정책

### 입력 영상

명시적으로 받을 수 있는 MIME:

```text
video/mp4
video/webm
video/ogg
video/quicktime
video/*
```

단, `accept` 속성은 파일 선택 필터일 뿐 실제 디코딩 보장은 아니다.

실제 디코딩 가능 여부는 브라우저의 `<video>` 지원 범위에 따른다.

### 출력 GIF

현재는 로컬 GIF 인코더를 사용한다.

장점:

- CDN 없이 동작한다.
- Cloudflare Pages 같은 정적 호스팅에서 그대로 작동한다.
- 네트워크가 없어도 변환 가능하다.

제약:

- 256색 GIF 포맷 특성상 원본 영상 대비 색 손실이 있다.
- 고품질 설정은 모바일에서 느릴 수 있다.
- 대형 영상/긴 구간은 메모리 부담이 크다.

### 출력 영상

현재는 WebM을 우선한다.

가능 후보:

```text
video/webm;codecs=vp9
video/webm;codecs=vp8
video/webm
```

브라우저가 `MediaRecorder.isTypeSupported()`로 지원하는 첫 번째 MIME을 사용한다.

### MP4 출력

현재 정적 브라우저 구현에서는 MP4 출력을 넣지 않는다.

이유:

- 브라우저 기본 `MediaRecorder`의 MP4 지원은 환경별 편차가 크다.
- 안정적인 MP4 인코딩은 `ffmpeg.wasm`이 필요하다.
- `ffmpeg.wasm`은 용량과 메모리 사용량이 커서 모바일에 부담이 크다.

MP4 출력은 별도 단계로 검토한다.

## 6. 성능 제한

영상 → GIF는 프레임 수가 많으면 매우 무겁다.

현재 안전장치:

- FPS 최대 24
- 기본 출력 너비 320px
- 프레임 수 240개 초과 시 변환 중단
- 품질 기본값은 균형값으로 둔다.

권장 기본값:

```text
구간: 1~3초
FPS: 8~12
출력 너비: 320~480px
품질: 5~8
```

모바일에서는 다음을 권장한다.

```text
구간: 1~2초
FPS: 8~10
출력 너비: 240~320px
품질: 8~12
```

## 7. 테스트 체크리스트

### 공통

- [ ] 왼쪽 메뉴로 화면 전환이 된다.
- [ ] 네비게이션 그룹을 접고 펼칠 수 있다.
- [ ] 스프라이트 도구 그룹 안에 스프라이트 편집기가 있다.
- [ ] 미디어 변환 그룹 안에 영상 → GIF, GIF → 영상이 있다.
- [ ] 스프라이트 편집기 기존 기능이 유지된다.
- [ ] 변환 기능 사용 중에도 스프라이트 편집 버튼이 깨지지 않는다.
- [ ] 파일은 서버에 업로드되지 않는다.

### 영상 → GIF

- [ ] MP4 파일을 선택할 수 있다.
- [ ] 영상 미리보기가 표시된다.
- [ ] 시작/종료/FPS/너비 설정이 반영된다.
- [ ] 품질값이 낮을수록 더 오래 걸리지만 색 품질이 개선된다.
- [ ] 진행률이 표시된다.
- [ ] GIF 다운로드 링크가 생성된다.
- [ ] 너무 많은 프레임이면 경고가 나온다.
- [ ] CDN이 없어도 `src/vendor/gif.js`로 변환된다.

### GIF → WebM

- [ ] GIF 파일을 선택할 수 있다.
- [ ] GIF 미리보기가 표시된다.
- [ ] WebM 변환이 시작된다.
- [ ] 진행률이 표시된다.
- [ ] WebM 다운로드 링크가 생성된다.
- [ ] 브라우저가 MediaRecorder를 지원하지 않으면 안내한다.

## 8. 앞으로 개선 방향

1. `gifuct-js` 기반 정밀 GIF 디코딩
2. 영상 프레임을 출력 순서에 직접 추가하는 기능
3. 영상 → 스프라이트 시트 PNG 추출 기능
4. 변환 결과를 스프라이트 편집기로 넘기는 기능
5. ffmpeg.wasm 기반 MP4 출력 옵션
6. 변환 작업 취소 버튼
7. 모바일 메모리 사용량 제한/경고 강화
8. GIF 인코더에 dithering 추가
9. GIF 인코더에 frame-diff 최적화 추가
10. GIF 인코더 worker 분리로 UI 멈춤 완화
