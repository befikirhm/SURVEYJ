// -------------------------------------------------------------------
// 4. JSOM PERMISSIONS – 100% WORKING (SP 2016 On-Prem)
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  // Ensure ALL required scripts are loaded
  SP.SOD.executeFunc('sp.js', 'SP.ClientContext', () => {
    SP.SOD.executeFunc('user.js', 'SP.User', () => {
      const ctx = SP.ClientContext.get_current();
      const web = ctx.get_web();
      const list = web.get_lists().getByTitle('Surveys');
      const item = list.getItemById(itemId);

      item.breakRoleInheritance(true, false);

      const role = web.get_roleDefinitions().getByType(SP.RoleType.contributor);
      const binding = SP.RoleDefinitionBindingCollection.newObject(ctx);
      binding.add(role);

      // CRITICAL: Use ensureUser for each ID
      const siteUsers = web.get_siteUsers();

      ownerIds.forEach(id => {
        if (typeof id === 'number' && id > 0) {
          try {
            const user = siteUsers.getById(id);
            ctx.load(user);
            item.get_roleAssignments().add(user, binding);
          } catch (e) {
            console.warn('User ID not found in siteUsers:', id);
          }
        }
      });

      ctx.load(item);
      ctx.executeQueryAsync(
        () => {
          console.log('Permissions granted successfully');
          onSuccess();
        },
        (sender, args) => {
          console.error('JSOM Error:', args.get_message());
          onError(args.get_message());
        }
      );
    });
  });
}