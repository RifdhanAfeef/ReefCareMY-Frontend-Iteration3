import styles from "./page-template.module.css";
import { BackButton } from "@/components/navigation/back-button";

type PageTemplateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  showBackButton?: boolean;
  backFallbackHref?: string;
  backLabel?: string;
  centered?: boolean;
  headerAction?: React.ReactNode;
};

export function PageTemplate({
  eyebrow,
  title,
  description,
  children,
  showBackButton = false,
  backFallbackHref = "/",
  backLabel = "Back",
  centered = false,
  headerAction,
}: PageTemplateProps) {
  return (
    <div className={`${styles.page} ${centered ? styles.centered : ""}`}>
      {showBackButton && (
        <BackButton fallbackHref={backFallbackHref} label={backLabel} />
      )}
      <header className={`${styles.heading} ${headerAction ? styles.headingWithAction : ""}`}>
        <div className={styles.headingCopy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
      </header>

      <section
        className={`${styles.workspace} ${children ? styles.workspaceReady : ""}`}
        aria-label={`${title} content area`}
      >
        {children ?? (
          <p>
            Replace this workspace with the approved wireframe content for this
            route.
          </p>
        )}
      </section>
    </div>
  );
}
