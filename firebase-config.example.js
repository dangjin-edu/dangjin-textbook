/**
 * Firebase 연동용 설정 예시 파일입니다.
 * 실제 운영 시에는 이 파일을 복사하여 firebase-config.js 로 만들고,
 * Firebase 콘솔에서 발급받은 프로젝트 설정값을 채워 넣으세요.
 * (Firebase 웹 API 키는 공개 키이지만, Firestore/Storage 보안 규칙과 Auth로 편집 권한을 제한해야 합니다.)
 */
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * 권장 Firestore 데이터 구조:
 * - 컬렉션: textbooks/{bookId}
 *   - title: "2026 우리 고장 당진"
 *   - pdfUrl: "https://firebasestorage.googleapis.com/..." (또는 GitHub Pages 정적 경로 ./books/dangjin.pdf)
 *   - totalPages: 59
 *   - updatedAt: Timestamp
 * - 하위 컬렉션 또는 필드: hotspots: [
 *     { id, page, x, y, type: "video" | "article" | "answer", title, url, note, answer, answerStyle, scale }
 *   ]
 *
 * 권장 보안 규칙 개념:
 * - 읽기(read): 누구나 허용 (관찰자 모드 링크 공유 시 로그인 없이 열람 가능)
 * - 쓰기(write): 로그인한 관리자(교사/운영자 UID 또는 이메일)만 허용
 */
