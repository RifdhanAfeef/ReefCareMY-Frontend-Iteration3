import Link from "next/link";
import type { AccessRequest } from "./types";
import { getUserRoleLabel } from "./role-catalog";
import { StatusPill } from "./status-pill";
import styles from "./access-ui.module.css";

export function AccessRequestList({ requests }: { requests: AccessRequest[] }) {
  return (
    <div className={styles.stack}>
      <section className={styles.notice}>
        <strong>Access-request management is not available yet</strong>
        These are preview records. Requests cannot be loaded, approved or rejected
        from this screen yet.
      </section>

      <section className={styles.tableCard} aria-label="Coordinator access requests">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">User</th>
                <th scope="col">Requested role</th>
                <th scope="col">Requested</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className={styles.identifier}>{request.id}</td>
                  <td>
                    {request.userName}
                    <div className={styles.muted}>{request.email}</div>
                  </td>
                  <td>{getUserRoleLabel(request.requestedRole)}</td>
                  <td>{request.requestedAt}</td>
                  <td>
                    <StatusPill status={request.status} />
                  </td>
                  <td>
                    <Link
                      className={styles.textButton}
                      href={`/admin/role-requests/${request.id}`}
                    >
                      Review request
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
