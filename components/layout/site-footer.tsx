import Link from "next/link";
import styles from "./site-footer.module.css";

const exploreLinks = [
  { label: "Explore reefs", href: "/explore" },
  { label: "Reef threats", href: "/reef-threats" },
  { label: "Plan a dive", href: "/plan-a-dive" },
];

const takePartLinks = [
  { label: "Report a reef threat", href: "/report-a-reef" },
  { label: "My reports", href: "/my-reports" },
  { label: "Create an account", href: "/register" },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.about}>
          <strong className={styles.name}>ReefCare MY</strong>
          <p>Community reef observation for Malaysia. Every report goes to a case coordinator, and exact report locations are never made public.</p>
        </div>
        <nav className={styles.column} aria-label="Explore">
          <h2>Explore</h2>
          <ul>{exploreLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
        </nav>
        <nav className={styles.column} aria-label="Take part">
          <h2>Take part</h2>
          <ul>{takePartLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
        </nav>
      </div>
      <p className={styles.note}>Dive planning information is guidance only, not dive clearance. Always confirm conditions with local operators.</p>
    </footer>
  );
}
