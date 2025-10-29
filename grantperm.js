// -------------------------------------------------------------------
// 4. REST-ONLY PERMISSIONS – LIST + ITEM
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  if (!ownerIds.length) return onSuccess();

  getDigest().then(digest => {
    const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
    const itemUrl = listUrl + `/items(${itemId})`;

    // 1. Break item inheritance
    $.ajax({
      url: itemUrl + '/breakroleinheritance(copyRoleAssignments=false)',
      method: 'POST',
      headers: { 'X-RequestDigest': digest },
      xhrFields: { withCredentials: true }
    }).then(() => {
      // 2. Grant Edit on ITEM
      const itemPromises = ownerIds.map(id => {
        return $.ajax({
          url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741827)`,
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        });
      });

      // 3. Grant Read on LIST (so item appears in view)
      const listPromises = ownerIds.map(id => {
        return $.ajax({
          url: listUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        });
      });

      Promise.all([...itemPromises, ...listPromises])
        .then(onSuccess)
        .catch(err => {
          console.error('Permission grant failed:', err);
          onError(err);
        });
    }).catch(err => {
      console.error('Break inheritance failed:', err);
      onError(err);
    });
  });
}