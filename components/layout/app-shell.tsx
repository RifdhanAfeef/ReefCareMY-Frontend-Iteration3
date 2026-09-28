import type { HeaderAction, NavigationItem } from "@/config/navigation";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { RouteFocusManager } from "@/components/navigation/route-focus-manager";
import styles from "./app-shell.module.css";

type AppShellProps = {
  navigation: NavigationItem[];
  actions?: HeaderAction[];
  identity?: {
    label: string;
    initial: string;
  };
  children: React.ReactNode;
};

export function AppShell({
  navigation,
  actions,
  identity,
  children,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <SiteHeader navigation={navigation} actions={actions} identity={identity} />
      <main className={styles.main}>
        <RouteFocusManager />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
