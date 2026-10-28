---
name: release
description: SPM 변경사항을 운영(main)에 배포할 때 사용. 사용자가 "배포해줘/배포 ㄱㄱ"라고 명시했을 때만 브랜치를 main에 병합하고 push한다. 타입체크·빌드 검증, 병합, push, 브랜치 정리, 배포 후 확인까지의 절차. "배포", "머지", "푸시", "올려줘" 요청에 사용.
---

# 배포 절차 (SPM)

운영 도메인: https://www.soccerpositionmanagement.com — GitHub `main`에 push하면 Vercel이 자동 배포한다.
**되돌리기 어려운 작업이므로 사용자 승인 없이는 `main`에 병합·push하지 않는다.**

## 0. 시작 조건 (하나라도 아니면 멈추고 묻는다)
- 사용자가 **이번 변경을 배포하라고 명시**했다 ("배포해줘", "배포 ㄱㄱ"). 이전 승인은 이번 건에 유효하지 않다.
- DB 변경(새 테이블·함수)이 있으면 **SQL이 이미 실행됐는지** 확인한다. 안 됐으면 먼저 `db-migration` 스킬 절차를 따른다(테이블이 없는 채로 배포하면 API가 깨진다).
- 변경이 **기능/수정 브랜치**에 커밋돼 있다 (`git branch --show-current` 로 확인, `main`에 직접 커밋한 게 아니어야 함).

## 1. 병합 전 검증
```bash
git status --short                 # 커밋 안 된 변경이 없어야 함
npx tsc --noEmit                   # 출력이 없어야 통과
npm run build                      # 종료 코드 0
```
- UI 변경은 가능하면 `preview_start`로 실제 화면을 확인한다. 로그인이 필요해 못 하면 **못 했다고 사용자에게 말한다**(검증한 척하지 않기).
- 로직 변경은 실제 소스 함수를 뽑아 시나리오 테스트로 확인한다.

## 2. 병합 → 검증 → push
```bash
git checkout main
git pull origin main --ff-only
git merge --no-ff <브랜치> -m "Merge: <한 줄 설명>"
npx tsc --noEmit && npm run build   # main에서 한 번 더
git push origin main
git branch -d <브랜치>
```
- 병합 후 검증이 실패하면 push하지 않는다.
- 여러 브랜치를 한 번에 배포할 때는 충돌이 나면 두 변경을 모두 살려서 해결하고, 해결 후 다시 검증한다.

## 3. 배포 후 확인
- 몇 분 뒤 운영 사이트에서 확인한다. 예: `curl -s https://www.soccerpositionmanagement.com/...` 로 바뀐 내용(제목, 사이트맵, 아이콘 등)이 반영됐는지.
- Vercel 캐시로 바로 안 바뀔 수 있으니 안 보이면 잠시 후 다시 확인한다.
- **배포가 끝났는지**는 GitHub 커밋 상태로 확인한다 (`gh` CLI는 없음): `curl -s https://api.github.com/repos/dkqpqp2/SoccerPosition/commits/<커밋sha>/status` 의 `description`이 "Vercel is deploying your app"이면 진행 중, "Deployment has completed"이면 완료. 빌드 실패와 단순 지연을 이걸로 구분한다.
- 진행 중이면 **반복 대기 루프를 돌리지 말고** 한 번만 확인한 뒤 사용자에게 "몇 분 뒤 확인해줘라고 말해 달라"고 안내한다.
- 상태 확인 주소로 사이트·DB 생존을 본다: `curl -s https://www.soccerpositionmanagement.com/api/health` → `{"status":"ok","db":"up"}` 이어야 한다 (DB가 안 닿으면 503).
- 사용자에게 알린다: 커밋 범위(`이전..이후`), 반영까지 걸리는 시간, 사용자가 직접 확인할 것.

## 하지 말 것
- `main`에 직접 커밋 / force push / 훅 건너뛰기(`--no-verify`).
- **커밋하지 않은 작업이 있는 상태에서** `git checkout -- .`, `git reset --hard`, `git clean` 실행 (작업이 사라진다 — 실제로 한 번 겪음). 위험한 명령 전에는 먼저 커밋하거나 stash한다.
- **아직 병합 안 된 기능 브랜치 위에서** 새 브랜치를 따는 것 — 그 브랜치의 미승인 변경이 같이 배포된다(실제로 한 번 겪음). 새 브랜치는 항상 `git checkout main && git pull` 후에 만든다.
- 검증하지 않은 것을 검증했다고 보고하기.

## Android/iOS 네이티브 변경이 포함된 경우
웹 배포만으로는 앱에 반영되지 않는다. `android/app/build.gradle`의 `versionCode`/`versionName`을 올리고 `npx cap sync android` → `cd android && ./gradlew bundleRelease`로 새 `.aab`를 만들어 Play Console에 직접 올려야 한다. (웹 화면만 바뀐 경우는 해당 없음 — 앱이 운영 사이트를 그대로 불러온다.)

## 보고 형식 (두 문장 이내)
무엇이 배포됐는지(커밋 범위)와 사용자가 확인할 것 한 가지.
