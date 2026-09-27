-- Assignees can report work status without broadening the task UPDATE policy.
create or replace function public.update_pursuit_task_progress(
 org uuid, pursuit uuid, task_id uuid, expected_version timestamptz, progress_status text
) returns uuid language plpgsql security definer set search_path='' as $$
declare member public.organization_role; current_task public.pursuit_tasks;
begin
 if auth.uid() is null then raise exception 'Task access required' using errcode='42501'; end if;
 -- Keep suspension and membership changes serialized with this mutation.
 perform 1 from public.organizations o where o.id=org and o.status<>'suspended' for share;
 if not found then raise exception 'Task access required' using errcode='42501'; end if;
 select m.role into member from public.organization_memberships m
  where m.organization_id=org and m.user_id=auth.uid() and m.status='active' for share;
 if member is null or member not in ('organization_admin','capture_manager','executive_approver','estimator','contributor')
  then raise exception 'Task access required' using errcode='42501'; end if;
 select * into current_task from public.pursuit_tasks t
  where t.organization_id=org and t.pursuit_id=pursuit and t.id=task_id for update;
 if not found or current_task.assigned_user_id is distinct from auth.uid()
  then raise exception 'Task assignment required' using errcode='42501'; end if;
 if expected_version is null or current_task.updated_at is distinct from expected_version
  then raise exception 'Task changed; reload before saving' using errcode='P0001'; end if;
 if progress_status is null or progress_status not in ('todo','in_progress','complete')
  then raise exception 'Choose a task status' using errcode='22023'; end if;
 if not public.consume_admin_mutation() then raise exception 'Please wait before trying again'; end if;
 -- Existing triggers set completed_at, updated_at, and the authenticated audit actor.
 if current_task.status is distinct from progress_status then
  update public.pursuit_tasks t set status=progress_status
   where t.organization_id=org and t.pursuit_id=pursuit and t.id=task_id;
 end if;
 return task_id;
end $$;
revoke all on function public.update_pursuit_task_progress(uuid,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.update_pursuit_task_progress(uuid,uuid,uuid,timestamptz,text) to authenticated;
