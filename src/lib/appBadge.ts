type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** 홈 화면에 추가한 웹앱 아이콘의 숫자 배지를 안 읽은 알림 수로 맞춘다. 지원하지 않는 환경에서는 아무 일도 안 한다. */
export function syncAppBadge(count: number) {
  try {
    const nav = navigator as BadgeNavigator;
    if (count > 0) void nav.setAppBadge?.(count)?.catch(() => {});
    else void nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    // 배지는 부가 기능이라 실패해도 무시
  }
}
