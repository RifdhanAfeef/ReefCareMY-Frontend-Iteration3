import styles from "./reset-sorting-button.module.css";

export function ResetSortingButton({ onReset, separateFromTable = false }: {
  onReset: () => void;
  separateFromTable?: boolean;
}) {
  return <div className={`${styles.controls} ${separateFromTable ? styles.tableSpacing : ""}`}>
    <button type="button" className={styles.button} onClick={onReset}>Reset sorting</button>
  </div>;
}
