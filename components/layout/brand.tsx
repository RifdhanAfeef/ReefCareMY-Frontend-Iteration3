import Image from "next/image";
import Link from "next/link";
import styles from "./site-header.module.css";

export function Brand() {
  return (
    <Link className={styles.brand} href="/" aria-label="ReefCare MY home">
      <Image
        className={styles.brandLogo}
        src="/images/reefcare-logo.png"
        alt="ReefCare MY"
        width={1004}
        height={303}
        priority
      />
    </Link>
  );
}
