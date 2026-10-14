import { StaffList } from "@/components/admin/StaffList";
import { getAllStaff } from "@/lib/actions/staff";

export default async function AdminStaffPage() {
  const staff = await getAllStaff();

  return <StaffList initialStaff={staff} />;
}