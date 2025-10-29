// -------------------------------------------------------------------
// 4. REST-ONLY PERMISSIONS (SP 2016 SAFE)
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  if (!ownerIds.length) return onSuccess();

  getDigest().then(digest => {
    const baseUrl = spUrl(`_api/web/lists/getbytitle('Surveys')/items(${itemId})`);

    // 1. Break inheritance (no copy)
    $.ajax({
      url: baseUrl + '/breakroleinheritance(copyRoleAssignments=false)',
      method: 'POST',
      headers: { 'X-RequestDigest': digest },
      xhrFields: { withCredentials: true }
    }).then(() => {
      // 2. Grant Edit to each owner
      const promises = ownerIds.map(id => {
        return $.ajax({
          url: baseUrl + '/roleassignments/addroleassignment(principalid=' + id + ', roledefid=1073741826)',
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        });
      });

      Promise.all(promises)
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