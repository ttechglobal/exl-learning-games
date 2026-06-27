export interface ScreenPoint {
  x: number;
  y: number;
}

const IONIC_TRANSFER_DURATION_MS = 420;
const COVALENT_ORBIT_LIFETIME_MS = 900;

export function fireIonicTransfer(from: ScreenPoint, to: ScreenPoint): void {
  if (typeof document === "undefined") return;
  const electron = document.createElement("div");
  electron.style.position = "fixed";
  electron.style.left = `${from.x}px`;
  electron.style.top = `${from.y}px`;
  electron.style.width = "10px";
  electron.style.height = "10px";
  electron.style.borderRadius = "50%";
  electron.style.background = "gold";
  electron.style.boxShadow = "0 0 8px 3px gold";
  electron.style.zIndex = "22";
  electron.style.pointerEvents = "none";
  electron.style.transition = `left ${IONIC_TRANSFER_DURATION_MS}ms ease-in-out, top ${IONIC_TRANSFER_DURATION_MS}ms ease-in-out, transform ${IONIC_TRANSFER_DURATION_MS}ms ease-in-out`;
  document.body.appendChild(electron);
  requestAnimationFrame(() => {
    electron.style.left = `${to.x}px`;
    electron.style.top = `${to.y}px`;
    electron.style.transform = "scale(1.4)";
  });
  setTimeout(() => electron.remove(), IONIC_TRANSFER_DURATION_MS + 30);
}

export function fireCovalentSharing(pointA: ScreenPoint, pointB: ScreenPoint): void {
  if (typeof document === "undefined") return;
  const midX = (pointA.x + pointB.x) / 2;
  const midY = (pointA.y + pointB.y) / 2;

  for (let i = 0; i < 2; i++) {
    const shared = document.createElement("div");
    shared.style.position = "fixed";
    shared.style.left = `${midX}px`;
    shared.style.top = `${midY}px`;
    shared.style.width = "9px";
    shared.style.height = "9px";
    shared.style.borderRadius = "50%";
    shared.style.background = "#fff";
    shared.style.border = "2px solid var(--eg-subject-chemistry, #7b4fcb)";
    shared.style.boxShadow = "0 0 6px rgba(123,79,203,0.6)";
    shared.style.zIndex = "22";
    shared.style.pointerEvents = "none";
    shared.style.animation = "eg-shared-orbit 1.4s linear infinite";
    shared.style.animationDelay = `${i * 0.7}s`;
    document.body.appendChild(shared);
    setTimeout(() => shared.remove(), COVALENT_ORBIT_LIFETIME_MS);
  }
}
