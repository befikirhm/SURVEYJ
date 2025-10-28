/* ========================================
   SharePoint 2016 Forms Dashboard
   ES5 Compatible – Bootstrap Styling
   Item-Level Permissions + Site Users Search
   ======================================== */

// CONFIG
var CONFIG = {
  LIST_NAME: 'Surveys',
  RESPONSE_LIST: 'SurveyResponses',
  ROLE_CONTRIBUTE: 1073741827,
  MAX_SEARCH_RESULTS: 10,
  SEARCH_DEBOUNCE_MS: 300,
  MANAGERS_GROUP: 'Managers' // Replace with actual group name
};

/* ---------- UTILS ---------- */
function getDigest() {
  return $.ajax({
    url: _spPageContextInfo.webAbsoluteUrl + '/_api/contextinfo',
    method: 'POST',
    headers: { 'Accept': 'application/json; odata=verbose' },
    xhrFields: { withCredentials: true }
  }).then(function (data) {
    return data.d.GetContextWebInformation.FormDigestValue;
  });
}

/* ---------- NOTIFICATION ---------- */
var Notification = function (props) {
  var cls = 'fixed top-4 right-4 p-4 rounded shadow-lg text-white max-w-sm z-2000 ';
  if (props.type === 'error') cls += 'bg-danger';
  else if (props.type === 'warning') cls += 'bg-warning';
  else if (props.type === 'info') cls += 'bg-info';
  else cls += 'bg-success';
  return React.createElement('div', { className: cls }, props.message);
};

/* ---------- API ---------- */
var API = {
  getSurveys: function () {
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('" + CONFIG.LIST_NAME + "')/items?" +
           "$select=Id,Title,StartDate,EndDate,Status,AuthorId,Owners/Id,Owners/Title&$expand=Owners",
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(function (d) { return d.d.results; });
  },

  getResponsesCount: function (id) {
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('" + CONFIG.RESPONSE_LIST + "')/items?" +
           "$filter=SurveyID/Id eq " + id,
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(function (d) { return d.d.results.length; });
  },

  searchSiteUsers: function (query) {
    if (!query || query.trim().length < 2) return Promise.resolve([]);
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/siteusers?" +
           "$filter=startswith(Title,'" + encodeURIComponent(query) + "')&$top=" + CONFIG.MAX_SEARCH_RESULTS,
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(function (d) {
      return d.d.results
        .filter(function (u) { return u.PrincipalType === 1; }) // Users only
        .map(function (u) { return { Id: u.Id, Title: u.Title }; });
    });
  },

  isUserManager: function (userId) {
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/sitegroups/getbyname('" + CONFIG.MANAGERS_GROUP + "')/users(" + userId + ")",
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(function () { return true; }).fail(function () { return false; });
  }
};

/* ---------- COMPONENTS ---------- */
var TopNav = function (props) {
  return React.createElement('nav', {
    className: 'navbar navbar-expand navbar-dark bg-primary fixed-top h-16'
  },
    React.createElement('div', { className: 'container-fluid' },
      React.createElement('div', { className: 'navbar-brand' },
        React.createElement('img', { src: '/SiteAssets/logo.png', alt: 'Logo', style: { height: '32px', marginRight: '8px' } }),
        'Forms'
      ),
      React.createElement('span', { className: 'navbar-text' }, 'Welcome, ' + props.userName)
    )
  );
};

var SideNav = function (props) {
  var _this = this;
  this.state = { isOpen: false, search: '', status: 'All' };

  this.toggle = function () { _this.setState({ isOpen: !_this.state.isOpen }); };
  this.setSearch = function (e) {
    var val = e.target.value;
    _this.setState({ search: val });
    props.onFilter({ searchTerm: val, status: _this.state.status });
  };
  this.setStatus = function (s) { return function () {
    _this.setState({ status: s });
    props.onFilter({ searchTerm: _this.state.search, status: s });
  };};

  var filters = ['All', 'Published', 'Draft', 'Upcoming', 'Running'];
  return React.createElement('div', {
    className: 'bg-dark text-white sidebar w-64 h-screen fixed top-0 left-0 md:static md:block z-900 ' +
               (this.state.isOpen ? 'show' : 'd-none d-md-block')
  },
    React.createElement('button', {
      className: 'btn btn-primary d-md-none mt-4 ms-3 z-1100 d-flex align-items-center',
      onClick: this.toggle
    },
      React.createElement('i', { className: this.state.isOpen ? 'fas fa-times me-2' : 'fas fa-bars me-2' }),
      this.state.isOpen ? 'Collapse' : 'Expand'
    ),
    React.createElement('div', { className: 'p-3' },
      React.createElement('input', {
        type: 'text', placeholder: 'Search forms...', value: this.state.search,
        onChange: this.setSearch,
        className: 'form-control bg-dark text-white mb-3'
      }),
      React.createElement('ul', { className: 'nav flex-column' },
        filters.map(function (f) {
          return React.createElement('li', { key: f, className: 'nav-item' },
            React.createElement('button', {
              className: 'nav-link text-white ' + (this.state.status === f ? 'active' : 'text-muted'),
              onClick: this.setStatus(f)
            }, f)
          );
        }.bind(this))
      )
    )
  );
};

var SurveyCard = function (props) {
  var s = props.survey;
  var start = s.StartDate ? new Date(s.StartDate).toLocaleDateString() : 'N/A';
  var end = s.EndDate ? new Date(s.EndDate).toLocaleDateString() : 'N/A';

  return React.createElement('div', { className: 'card h-100' },
    React.createElement('div', { className: 'card-header bg-light' },
      React.createElement('h5', { className: 'mb-0' }, s.Title)
    ),
    React.createElement('div', { className: 'card-body' },
      React.createElement('p', { className: 'mb-2' }, 'Status: ', React.createElement('span', { className: s.Status === 'Published' ? 'badge bg-success' : 'badge bg-secondary' }, s.Status || 'Draft')),
      React.createElement('p', { className: 'mb-2' }, 'Date: ' + start + ' - ' + end),
      React.createElement('p', { className: 'mb-2' }, 'Responses: ', React.createElement('span', { className: 'badge bg-primary' }, s.responseCount || 0)),
      React.createElement('div', null,
        React.createElement('small', { className: 'text-muted' }, 'Owners: '),
        s.Owners && s.Owners.results && s.Owners.results.length
          ? React.createElement('div', { className: 'mt-1' },
              s.Owners.results.map(function (o) {
                return React.createElement('span', { key: o.Id, className: 'badge bg-primary me-1' }, o.Title);
              })
            )
          : React.createElement('small', { className: 'text-muted' }, 'None')
      )
    ),
    React.createElement('div', { className: 'card-footer bg-light' },
      React.createElement('div', { className: 'btn-group btn-group-sm w-100' },
        React.createElement('button', { onClick: function () { window.open('/builder.aspx?surveyId=' + s.Id, '_blank'); }, className: 'btn btn-primary' },
          React.createElement('i', { className: 'fas fa-edit' }), ' Edit'
        ),
        React.createElement('button', { onClick: function () { window.open('/response.aspx?surveyId=' + s.Id, '_blank'); }, className: 'btn btn-success' },
          React.createElement('i', { className: 'fas fa-chart-bar' }), ' Report'
        ),
        React.createElement('button', { onClick: props.onQR, className: 'btn btn-info' },
          React.createElement('i', { className: 'fas fa-qrcode' }), ' QR'
        ),
        React.createElement('button', { onClick: props.onEdit, className: 'btn btn-warning' },
          React.createElement('i', { className: 'fas fa-cog' }), ' Metadata'
        ),
        React.createElement('button', { onClick: function () { window.open('/formfiller.aspx?surveyId=' + s.Id, '_blank'); }, className: 'btn btn-info' },
          React.createElement('i', { className: 'fas fa-pen' }), ' Fill'
        ),
        s.AuthorId === props.currentUserId && React.createElement('button', { onClick: props.onDelete, className: 'btn btn-danger' },
          React.createElement('i', { className: 'fas fa-trash' }), ' Delete'
        )
      )
    )
  );
};

/* ---------- MODALS ---------- */
var QRModal = function (props) {
  React.useEffect(function () {
    new QRious({
      element: document.getElementById('qr-' + props.survey.Id),
      value: _spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + props.survey.Id,
      size: 200
    });
  }, [props.survey.Id]);

  var download = function () {
    var canvas = document.getElementById('qr-' + props.survey.Id);
    var a = document.createElement('a');
    a.href = canvas.toDataURL();
    a.download = props.survey.Title.replace(/[^a-z0-9]/gi, '_') + '_QR.png';
    a.click();
  };
  var copyUrl = function () {
    navigator.clipboard.writeText(_spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + props.survey.Id)
      .then(function () { props.addNotification('Copied!', 'success'); })
      .catch(function () { props.addNotification('Copy failed.', 'error'); });
  };

  return React.createElement('div', { className: 'modal show d-block' },
    React.createElement('div', { className: 'modal-dialog' },
      React.createElement('div', { className: 'modal-content' },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h5', { className: 'modal-title' }, 'QR Code'),
          React.createElement('button', { type: 'button', className: 'btn-close', onClick: props.onClose })
        ),
        React.createElement('div', { className: 'modal-body text-center' },
          React.createElement('canvas', { id: 'qr-' + props.survey.Id, className: 'img-fluid' })
        ),
        React.createElement('div', { className: 'modal-footer' },
          React.createElement('button', { type: 'button', className: 'btn btn-info', onClick: copyUrl }, React.createElement('i', { className: 'fas fa-copy' }), ' Copy URL'),
          React.createElement('button', { type: 'button', className: 'btn btn-success', onClick: download }, React.createElement('i', { className: 'fas fa-download' }), ' Download'),
          React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onClose }, 'Close')
        )
      )
    )
  );
};

var DeleteModal = function (props) {
  return React.createElement('div', { className: 'modal show d-block' },
    React.createElement('div', { className: 'modal-dialog' },
      React.createElement('div', { className: 'modal-content' },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h5', { className: 'modal-title' }, 'Confirm Delete'),
          React.createElement('button', { type: 'button', className: 'btn-close', onClick: props.onCancel })
        ),
        React.createElement('div', { className: 'modal-body' },
          React.createElement('p', null, 'Delete "', React.createElement('strong', null, props.survey.Title), '"? This cannot be undone.')
        ),
        React.createElement('div', { className: 'modal-footer' },
          React.createElement('button', { type: 'button', className: 'btn btn-danger', onClick: props.onConfirm }, 'Confirm'),
          React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: props.onCancel }, 'Cancel')
        )
      )
    )
  );
};

/* ---------- MAIN APP ---------- */
var App = React.createClass({
  getInitialState: function () {
    return {
      surveys: [], filtered: [], user: { id: null, name: '' },
      notifications: [], modals: { create: false, edit: null, qr: null, delete: null }
    };
  },

  componentDidMount: function () {
    var _this = this;
    $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser',
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).done(function (d) {
      _this.setState({ user: { id: d.d.Id, name: d.d.Title } });
    });
    _this.loadSurveys();
  },

  addNotification: function (msg, type) {
    var id = Date.now();
    this.setState({
      notifications: this.state.notifications.concat([{ id: id, message: msg, type: type || 'success' }])
    });
    setTimeout(function () {
      this.setState({
        notifications: this.state.notifications.filter(function (n) { return n.id !== id; })
      });
    }.bind(this), 5000);
  },

  loadSurveys: function () {
    var _this = this;
    API.getSurveys().then(function (items) {
      var promises = items.map(function (s) {
        return API.getResponsesCount(s.Id).then(function (c) { s.responseCount = c; return s; });
      });
      Promise.all(promises).then(function (updated) {
        _this.setState({ surveys: updated, filtered: updated });
      });
    });
  },

  filterSurveys: function (f) {
    var list = this.state.surveys.slice();
    if (f.searchTerm) list = list.filter(function (s) { return s.Title.toLowerCase().indexOf(f.searchTerm.toLowerCase()) > -1; });
    if (f.status && f.status !== 'All') list = list.filter(function (s) { return s.Status === f.status; });
    this.setState({ filtered: list });
  },

  openModal: function (type, payload) {
    var m = { create: false, edit: null, qr: null, delete: null };
    m[type] = payload || true;
    this.setState({ modals: m });
  },

  closeModal: function (type) {
    var m = this.state.modals;
    m[type] = null;
    if (type === 'create') m.create = false;
    this.setState({ modals: m });
  },

  render: function () {
    var _this = this;
    return React.createElement('div', { className: 'min-h-screen bg-light' },
      React.createElement(TopNav, { userName: this.state.user.name }),

      React.createElement('div', { className: 'd-flex pt-4 pt-md-0' },
        React.createElement(SideNav, { onFilter: this.filterSurveys }),

        React.createElement('main', { className: 'flex-grow p-4' },
          React.createElement('div', { className: 'd-flex justify-content-between align-items-center mb-4' },
            React.createElement('h1', { className: 'h2' }, 'Forms'),
            React.createElement('button', {
              onClick: function () { _this.openModal('create'); },
              className: 'btn btn-primary d-flex align-items-center'
            }, React.createElement('i', { className: 'fas fa-plus me-2' }), 'Create New Form')
          ),

          React.createElement('div', { className: 'row g-3' },
            this.state.filtered.map(function (s) {
              return React.createElement('div', { key: s.Id, className: 'col-md-4' },
                React.createElement(SurveyCard, {
                  survey: s, currentUserId: _this.state.user.id,
                  onEdit: function () { _this.openModal('edit', s); },
                  onQR: function () { _this.openModal('qr', s); },
                  onDelete: function () { _this.openModal('delete', s); },
                  addNotification: _this.addNotification
                })
              );
            })
          )
        )
      ),

      this.state.notifications.map(function (n) {
        return React.createElement(Notification, { key: n.id, message: n.message, type: n.type });
      }),

      this.state.modals.qr && React.createElement(QRModal, {
        survey: this.state.modals.qr,
        onClose: function () { _this.closeModal('qr'); },
        addNotification: _this.addNotification
      })
    );
  }
});

/* ---------- RENDER ---------- */
ReactDOM.render(React.createElement(App), document.getElementById('root'));