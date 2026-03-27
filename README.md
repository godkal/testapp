# 출근 준비 코치 (PWA)

위치 기반으로 오늘 출근 브리핑(우산/체감온도/대기질)을 보여주는 웹앱입니다.

## 로컬 실행

```bash
npx --yes serve -l 4173 .
```

- PC: `http://localhost:4173`

## 무료 실사용 배포 (GitHub Pages)

이 프로젝트는 정적 파일만 사용하므로 GitHub Pages 무료 플랜으로 배포 가능합니다.

1. 이 폴더를 GitHub 저장소에 push
2. GitHub 저장소에서 `Settings > Pages` 이동
3. `Source`를 `GitHub Actions`로 선택
4. `main` 브랜치에 push 하면 자동 배포

배포 주소 예시:
- `https://<github-id>.github.io/<repo-name>/`

## 휴대폰 사용

- 배포 URL을 휴대폰 브라우저에서 열기
- "홈 화면에 추가" 선택
- 앱처럼 실행 가능

## 참고

- `.github/workflows/deploy-pages.yml` 포함 (자동 배포)
- GitHub Pages 하위 경로(`/repo-name/`)에서도 동작하도록 상대 경로/PWA 스코프를 맞춰둠

