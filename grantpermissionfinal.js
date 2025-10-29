// -------------------------------------------------------------------
// 4. REST-ONLY PERMISSIONS – LIST + ITEM (READ + EDIT)
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
      const promises = [];

      // 2. Grant READ + EDIT on ITEM
      ownerIds.forEach(id => {
        // READ
        promises.push(
          $.ajax({
            url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          })
        );
        // EDIT
        promises.push(
          $.ajax({
            url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741827)`,
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          })
        );
      });

      // 3. Grant READ on LIST (for dashboard view)
      ownerIds.forEach(id => {
        promises.push(
          $.ajax({
            url: listUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          })
        );
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