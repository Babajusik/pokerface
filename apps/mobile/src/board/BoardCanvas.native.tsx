// Заглушка доски для native — реализация пока только web (canvas).
export function BoardCanvas(_props: {
  sendBoardOp: (op: any) => void;
  subscribeBoard: (fn: (op: any) => void) => () => void;
}) {
  return null;
}
