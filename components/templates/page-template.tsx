import styles from "./page-template.module.css";
import { BackButton } from "@/components/navigation/back-button";

type PageTemplateProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
  showBackButton?: boolean;
  backFallbackHref?: string;
  backLabel?: string;
  centered?: boolean;
  headerAction?: React.ReactNode;
  hideHeading?: boolean;
};

export function PageTemplate({
  title,
  description,
  children,
  showBackButton = false,
  backFallbackHref = "/",
  backLabel = "Back",
  centered = false,
  headerAction,
  hideHeading = false,
}: PageTemplateProps) {
  return (
    <div className={`${styles.page} ${centered ? styles.centered : ""}`}>
      {showBackButton && (
        <BackButton fallbackHref={backFallbackHref} label={backLabel} />
      )}
      {!hideHeading && <header className={`${styles.heading} ${headerAction ? styles.headingWithAction : ""}`}>
        <div className={styles.headingCopy}>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
      </header>}

      {children && (
        <section className={styles.workspace} aria-label={`${title} content area`}>
          {children}
        </section>
      )}
    </div>
  );
}
