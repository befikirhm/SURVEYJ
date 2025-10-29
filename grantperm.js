function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  getDigest().then(digest => {
    const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
    const itemUrl = listUrl + `/items(${itemId})`;

    // 1. Break inheritance
    $.ajax({
      url: itemUrl + '/breakroleinheritance(copyRoleAssignments=false)',
      method: 'POST',
      headers: { 'X-RequestDigest': digest },
      xhrFields: { withCredentials: true }
    }).then(() => {
      // 2. Get RoleDefinition for Edit
      $.ajax({
        url: listUrl + '/RoleDefinitions?$filter=RoleTypeKind eq 1', // Edit = 1
        headers: { 'Accept': 'application/json; odata=verbose' },
        xhrFields: { withCredentials: true }
      }).then(roleDefs => {
        const editRoleId = roleDefs.d.results[0].Id;

        // 3. Add Role Assignment for each owner
        const promises = ownerIds.map(id => {
          return $.ajax({
            url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=${editRoleId})`,
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          });
        });

        Promise.all(promises).then(onSuccess).catch(onError);
      });
    });
  });
}