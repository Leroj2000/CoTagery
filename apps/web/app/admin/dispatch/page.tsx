import { redirect } from 'next/navigation';

/** Výdej byl sjednocen do workflow scanneru (/admin/workflow). Zachová staré odkazy. */
export default function DispatchRedirect() {
  redirect('/admin/workflow');
}
