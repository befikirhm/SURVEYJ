// -------------------------------------------------------------------
// 4. REST-ONLY PERMISSIONS – LIST + ITEM + DEFAULT VIEW (SAFE)
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  if (!ownerIds.length) return onSuccess();

  getDigest().then(digest => {
    const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
    const itemUrl = listUrl + `/items(${itemId})`;

    // 1. Get DefaultViewUrl
    $.ajax({
      url: listUrl,
      headers: { 'Accept': 'application/json;odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(listData => {
      const defaultViewUrl = listData.d.DefaultViewUrl; // e.g. "/Lists/Surveys/AllItems.aspx"
      const viewName = defaultViewUrl.split('/').pop().split('.')[0]; // "AllItems"

      // 2. Get View GUID by Title
      $.ajax({
        url: listUrl + `/views?$filter=Title eq '${viewName}'`,
        headers: { 'Accept': 'application/json;odata=verbose' },
        xhrFields: { withCredentials: true }
      }).then(viewData => {
        const viewId = viewData.d.results[0]?.Id;
        if (!viewId) throw new Error('Default view not found');

        const viewUrl = listUrl + `/views('${viewId}')`;

        // 3. Break item inheritance
        $.ajax({
          url: itemUrl + '/breakroleinheritance(copyRoleAssignments=false)',
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        }).then(() => {
          const promises = [];

          // 4. Grant Edit on ITEM
          ownerIds.forEach(id => {
            promises.push(
              $.ajax({
                url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741827)`,
                method: 'POST',
                headers: { 'X-RequestDigest': digest },
                xhrFields: { withCredentials: true }
              })
            );
          });

          // 5. Grant Read on LIST
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

          // 6. Grant Read on DEFAULT VIEW
          ownerIds.forEach(id => {
            promises.push(
              $.ajax({
                url: viewUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
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
        });
      });
    }).catch(err => {
      console.error('Failed to get default view:', err);
      onError(err);
    });
  });
}