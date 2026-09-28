"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { approveCoordinator, getAdminUsers, updateAdminUser } from "@/lib/api/adminApi";
import type { AdminUser, AdminUserRole } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { adminUserRoleOptions, getUserRoleLabel } from "./role-catalog";
import { StatusPill } from "./status-pill";
import styles from "./access-ui.module.css";

function displayUserId(id: number) {
  return `USR-${String(id).padStart(4, "0")}`;
}

const directoryPageSize = 10;
const backendPageSize = 100;

async function getAllAdminUsers() {
  const firstPage = await getAdminUsers(1, backendPageSize);
  const effectivePageSize = firstPage.pageSize || backendPageSize;
  const pageCount = Math.ceil(firstPage.total / effectivePageSize);

  if (pageCount <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      getAdminUsers(index + 2, effectivePageSize),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((result) => result.items);
}

export function UserDirectory() {
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingCoordinator, setConfirmingCoordinator] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      setAccounts(await getAllAdminUsers());
    } catch (loadError) {
      setError(userFacingError(loadError, "The user directory could not be loaded. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void getAllAdminUsers()
      .then((users) => {
        if (!cancelled) setAccounts(users);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            userFacingError(loadError, "The user directory could not be loaded. Please try again."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((user) => {
      const matchesQuery = !normalizedQuery
        || user.displayName.toLowerCase().includes(normalizedQuery)
        || user.email.toLowerCase().includes(normalizedQuery)
        || displayUserId(user.id).toLowerCase().includes(normalizedQuery);
      return matchesQuery && (roleFilter === "all" || user.role === roleFilter);
    });
  }, [accounts, query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / directoryPageSize));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = visibleUsers.slice(
    (currentPage - 1) * directoryPageSize,
    currentPage * directoryPageSize,
  );
  const firstVisibleUser = visibleUsers.length === 0
    ? 0
    : (currentPage - 1) * directoryPageSize + 1;
  const lastVisibleUser = Math.min(currentPage * directoryPageSize, visibleUsers.length);

  const selectedUser = accounts.find((user) => user.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedUser) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setConfirmingCoordinator(false);
        setMessage("");
        setError("");
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedUser]);

  function beginEditing(user: AdminUser) {
    setSelectedId(user.id);
    setDisplayName(user.displayName);
    setIsActive(user.isActive);
    setConfirmingCoordinator(false);
    setMessage("");
    setError("");
  }

  function closeEditor() {
    setSelectedId(null);
    setConfirmingCoordinator(false);
    setMessage("");
    setError("");
  }

  async function saveChanges() {
    if (!selectedUser || !displayName.trim()) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await updateAdminUser(selectedUser.id, {
        displayName: displayName.trim(),
        isActive,
      });
      setAccounts((current) => current.map((user) => user.id === updated.id ? updated : user));
      setMessage(`Account settings for ${updated.displayName} were saved.`);
    } catch (saveError) {
      setError(userFacingError(saveError, "The account settings could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmCoordinatorAccess() {
    if (!selectedUser) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const approved = await approveCoordinator(selectedUser.id);
      setAccounts((current) => current.map((user) => user.id === approved.id
        ? { ...user, ...approved }
        : user));
      setConfirmingCoordinator(false);
      setMessage(`${approved.displayName} now has Case Coordinator access.`);
    } catch (approvalError) {
      setError(userFacingError(approvalError, "Coordinator access could not be approved. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.stack}>
      <section className={styles.notice} role="status">
        <strong>Administrator access only</strong>
        Account changes are saved to ReefCare. Coordinator approval changes the account role only; it does not grant ownership of any case or unrestricted location access.
      </section>

      <section className={styles.card} aria-labelledby="directory-title">
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.sectionHeading} id="directory-title">User directory</h2>
            <p className={styles.sectionDescription}>Manage safe account details and explicitly approve Coordinator access.</p>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.field}>
            <label htmlFor="user-search">Search users</label>
            <input className={styles.input} id="user-search" type="search" placeholder="Name, email or user ID" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          </div>
          <div className={`${styles.field} ${styles.fieldCompact}`}>
            <label htmlFor="role-filter">Role</label>
            <select className={styles.select} id="role-filter" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as AdminUserRole | "all"); setPage(1); }}>
              <option value="all">All account roles</option>
              {adminUserRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {error && !selectedUser && <p className={styles.formError} role="alert">{error}</p>}

      <section className={styles.tableCard} aria-label="ReefCare user accounts" aria-busy={loading}>
        {loading ? (
          <div className={styles.emptyState}>Loading user accounts...</div>
        ) : visibleUsers.length === 0 ? (
          <div className={styles.emptyState}>No users match the current search and role filter.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th scope="col">User ID</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
              <tbody>
                {pageUsers.map((user) => (
                  <tr key={user.id}>
                    <td className={styles.identifier}>{displayUserId(user.id)}</td>
                    <td>{user.displayName}<div className={styles.muted}>{user.email}</div></td>
                    <td>{getUserRoleLabel(user.role)}</td>
                    <td><StatusPill status={user.isActive ? "Active" : "Suspended"} /></td>
                    <td><button className={styles.textButton} type="button" onClick={() => beginEditing(user)}>{selectedId === user.id ? "Editing account" : "Manage account"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && visibleUsers.length > 0 && (
        <nav className={styles.pagination} aria-label="User directory pages">
          <span>{firstVisibleUser}–{lastVisibleUser} of {visibleUsers.length} users · Page {currentPage} of {totalPages}</span>
          <button className={styles.secondaryButton} type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <button className={styles.secondaryButton} type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
        </nav>
      )}

      {!loading && error && !selectedUser && <button className={styles.secondaryButton} type="button" onClick={() => void loadUsers()}>Try loading users again</button>}

      {selectedUser && (
        <div className={styles.modalBackdrop}>
        <section className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="edit-access-title">
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.sectionHeading} id="edit-access-title">Manage {selectedUser.displayName}</h2>
              <p className={styles.sectionDescription}>Role changes are restricted to the separate Coordinator approval action.</p>
            </div>
            <button ref={closeButtonRef} className={styles.modalCloseButton} type="button" onClick={closeEditor} aria-label="Close account manager">×</button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="account-name">Display name</label>
                <input className={styles.input} id="account-name" value={displayName} maxLength={100} onChange={(event) => setDisplayName(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="account-status">Account status</label>
                <select className={styles.select} id="account-status" value={isActive ? "active" : "suspended"} onChange={(event) => setIsActive(event.target.value === "active")}>
                  <option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
                <span className={styles.fieldHelp}>Suspending an account blocks access without deleting its history.</span>
              </div>
            </div>

            {message && <p className={styles.notice} role="status">{message}</p>}
            {error && <p className={styles.formError} role="alert">{error}</p>}

            <div className={styles.modalActions}>
              <button className={styles.primaryButton} type="button" disabled={saving || !displayName.trim()} onClick={() => void saveChanges()}>{saving ? "Saving..." : "Save account settings"}</button>
              <button className={styles.secondaryButton} type="button" disabled={saving} onClick={closeEditor}>Cancel</button>
            </div>

            {selectedUser.role === "observer" && (
              <div className={styles.restrictionCard}>
                <h3>Case Coordinator approval</h3>
                <p className={styles.sectionDescription}>Approval gives access to the coordination workspace. Protected case information remains available only through the normal claim and ownership rules.</p>
                {!confirmingCoordinator ? (
                  <button className={styles.secondaryButton} type="button" onClick={() => setConfirmingCoordinator(true)}>Approve as Case Coordinator</button>
                ) : (
                  <div className={styles.buttonRow}>
                    <button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void confirmCoordinatorAccess()}>{saving ? "Approving..." : "Confirm Coordinator access"}</button>
                    <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => setConfirmingCoordinator(false)}>Keep Observer role</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        </div>
      )}
    </div>
  );
}
