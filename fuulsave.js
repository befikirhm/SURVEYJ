save() {
  const f = this.state.form;
  if (!f.Title.trim()) return this.props.addNotification('Title required', 'error');

  this.setState({ saving: true });

  const ensurePromises = f.Owners
    .filter(o => o.Key && !o.Id)
    .map(o => ensureUser(o.Key).then(id => ({ ...o, Id: id })));

  Promise.all(ensurePromises).then(resolved => {
    const allOwners = f.Owners.map(o => resolved.find(r => r.Key === o.Key) || o);

    getDigest().then(digest => {
      const payload = {
        __metadata: { type: 'SP.Data.SurveysListItem' },
        Title: f.Title,
        Status: 'Draft',
        OwnersId: { results: allOwners.map(o => o.Key).filter(k => k) },
        surveyData: JSON.stringify({ title: f.Title })
      };
      if (f.StartDate) payload.StartDate = new Date(f.StartDate).toISOString();
      if (f.EndDate)   payload.EndDate   = new Date(f.EndDate).toISOString();

      $.ajax({
        url: spUrl('_api/web/lists/getbytitle(\'Surveys\')/items'),
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).then(r => {
        grantEditPermissionToOwners(r.d.Id, allOwners.map(o => o.Id),
          () => {
            this.props.addNotification('Created!', 'success');
            window.open(`/builder.aspx?surveyId=${r.d.Id}`, '_blank');
            this.props.loadSurveys();
            this.props.onClose();
          },
          () => this.setState({ saving: false })
        );
      }).catch(err => {
        console.error(err);
        this.props.addNotification('Create failed', 'error');
        this.setState({ saving: false });
      });
    });
  });
}