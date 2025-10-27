const { useState, useEffect, useRef } = React;
const e = React.createElement;

const baseUrl = window._spPageContextInfo ? window._spPageContextInfo.webAbsoluteUrl : '';
const listItemType = 'SP.Data.SurveysListItem';
const contributeRoleId = 1073741827;

function getRequestDigest() {
  return document.getElementById('__REQUESTDIGEST')?.value || '';
}

function TopNav({ currentUser, toggleSideNav, isSideNavOpen }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      console.log('TopNav height:', ref.current.offsetHeight);
    }
  }, []);
  return e('div', { id: 'topnav', ref: ref, className: 'fixed z-[1000] h-16 bg-blue-600 w-full flex items-center px-4 text-white' },
    e('button', { className: 'md:hidden mr-4', onClick: toggleSideNav },
      e('i', { className: `fa ${isSideNavOpen ? 'fa-times' : 'fa-bars'}` })
    ),
    e('img', { src: '/SiteAssets/logo.png', className: 'h-8' }),
    e('span', { className: 'ml-2 text-lg' }, 'Forms'),
    e('span', { className: 'ml-auto' }, `Welcome, ${currentUser ? currentUser.Title : 'User'}`)
  );
}

function SideNav({ isOpen, setOpen, searchTerm, setSearchTerm, statusFilter, setStatusFilter }) {
  const filters = ['All', 'Published', 'Draft', 'Upcoming', 'Running'];
  return e('div', { className: `fixed md:static top-16 left-0 w-64 h-[calc(100vh-4rem)] bg-white z-[900] overflow-y-auto ${isOpen ? 'block' : 'hidden md:block'}` },
    e('div', { className: 'p-4' },
      e('input', {
        type: 'text',
        placeholder: 'Search by title...',
        className: 'w-full p-2 border rounded',
        value: searchTerm,
        onChange: (evt) => setSearchTerm(evt.target.value)
      }),
      e('ul', { className: 'mt-4' },
        filters.map(f => e('li', { key: f },
          e('button', {
            className: `w-full text-left p-2 ${statusFilter === f ? 'bg-blue-200' : ''}`,
            onClick: () => { setStatusFilter(f); setOpen(false); }
          }, f)
        ))
      )
    )
  );
}

function SurveyCard({ survey, responsesCount, currentUserId, onEdit, onDelete, onShowQR }) {
  const owners = survey.Owners || [];
  return e('div', { className: 'bg-white p-4 rounded shadow' },
    e('h3', { className: 'font-bold' }, survey.Title),
    e('p', null, 'Status: ', survey.Status),
    e('p', null, 'Date: ', new Date(survey.StartDate).toLocaleDateString(), ' - ', new Date(survey.EndDate).toLocaleDateString()),
    e('p', null, 'Responses: ', responsesCount[survey.Id] || 0),
    e('div', null, 'Owners: ',
      owners.map(o => e('span', { key: o.Id, className: 'bg-blue-100 px-2 py-1 m-1 rounded inline-block' }, o.Title))
    ),
    e('div', { className: 'mt-4 flex flex-wrap gap-2' },
      e('button', { className: 'bg-blue-500 text-white px-2 py-1 rounded', onClick: () => window.open(`builder.aspx?surveyId=${survey.Id}`, '_blank') }, 'Edit Form'),
      e('button', { className: 'bg-green-500 text-white px-2 py-1 rounded', onClick: () => window.open(`response.aspx?surveyId=${survey.Id}`, '_blank') }, 'View Report'),
      e('button', { className: 'bg-purple-500 text-white px-2 py-1 rounded', onClick: () => onShowQR(survey.Id) }, 'QR Code'),
      e('button', { className: 'bg-yellow-500 text-white px-2 py-1 rounded', onClick: () => onEdit(survey) }, 'Edit Metadata'),
      e('button', { className: 'bg-indigo-500 text-white px-2 py-1 rounded', onClick: () => window.open(`formfiller.aspx?surveyId=${survey.Id}`, '_blank') }, 'Fill Form'),
      survey.AuthorId === currentUserId && e('button', { className: 'bg-red-500 text-white px-2 py-1 rounded', onClick: () => onDelete(survey.Id) }, 'Delete')
    )
  );
}

function QRModal({ surveyId, onClose, showNotification }) {
  const url = `${baseUrl}/formfiller.aspx?surveyId=${surveyId}`;
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      new QRious({ element: ref.current, value: url, size: 200 });
    }
  }, []);
  const handleDownload = () => {
    const canvas = ref.current;
    const link = document.createElement('a');
    link.download = 'qr.png';
    link.href = canvas.toDataURL();
    link.click();
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => showNotification('success', 'URL copied to clipboard'));
  };
  return e('div', { className: 'fixed z-[1200] inset-0 bg-black bg-opacity-50 flex items-center justify-center' },
    e('div', { className: 'bg-white p-4 rounded max-w-sm w-full' },
      e('canvas', { ref: ref, id: 'qr-canvas' }),
      e('div', { className: 'mt-4 flex justify-around' },
        e('button', { className: 'bg-blue-500 text-white px-2 py-1', onClick: handleCopy }, 'Copy URL'),
        e('button', { className: 'bg-green-500 text-white px-2 py-1', onClick: handleDownload }, 'Download'),
        e('button', { className: 'bg-red-500 text-white px-2 py-1', onClick: onClose }, 'Close')
      )
    )
  );
}

function DeleteModal({ surveyId, onClose, onConfirm, showNotification }) {
  const handleDelete = () => {
    const digest = getRequestDigest();
    $.ajax({
      url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items(${surveyId})`,
      type: 'POST',
      headers: { 'X-HTTP-Method': 'DELETE', 'If-Match': '*', 'X-RequestDigest': digest },
      success: () => {
        showNotification('success', 'Survey deleted');
        onConfirm();
      },
      error: () => showNotification('error', 'Failed to delete survey')
    });
    onClose();
  };
  return e('div', { className: 'fixed z-[1200] inset-0 bg-black bg-opacity-50 flex items-center justify-center' },
    e('div', { className: 'bg-white p-4 rounded' },
      e('p', null, 'Are you sure you want to delete this survey?'),
      e('div', { className: 'mt-4 flex justify-end gap-2' },
        e('button', { className: 'bg-gray-500 text-white px-2 py-1', onClick: onClose }, 'Cancel'),
        e('button', { className: 'bg-red-500 text-white px-2 py-1', onClick: handleDelete }, 'Delete')
      )
    )
  );
}

function EditModal({ survey, onClose, onSave, currentUser, showNotification }) {
  const [formData, setFormData] = useState({
    startDate: survey.StartDate.split('T')[0],
    endDate: survey.EndDate.split('T')[0],
    status: survey.Status,
    owners: survey.Owners || []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [memberUsers, setMemberUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [groupId, setGroupId] = useState(null);

  useEffect(() => {
    $.ajax({
      url: `${baseUrl}/_api/web/associatedmembergroup?$select=Id`,
      headers: { accept: 'application/json;odata=verbose' },
      success: (data) => setGroupId(data.d.Id),
      error: () => showNotification('error', 'Failed to fetch member group')
    });
  }, []);

  useEffect(() => {
    if (groupId) {
      $.ajax({
        url: `${baseUrl}/_api/web/sitegroups(${groupId})/users?$select=Id,Title,LoginName`,
        headers: { accept: 'application/json;odata=verbose' },
        success: (data) => {
          console.log('Member users:', data.d.results);
          setMemberUsers(data.d.results);
        },
        error: () => showNotification('error', 'Failed to fetch users')
      });
    }
  }, [groupId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = memberUsers.filter(u =>
        u.Title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !formData.owners.some(o => o.Id === u.Id)
      );
      console.log('Filtered users:', filtered);
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers([]);
    }
  }, [searchTerm, memberUsers, formData.owners]);

  const addUser = (user) => {
    setFormData(prev => ({ ...prev, owners: [...prev.owners, { Id: user.Id, Title: user.Title }] }));
    setSearchTerm('');
  };

  const handleUserRemove = (userId) => {
    if (userId === currentUser.Id) {
      showNotification('warning', 'Cannot remove yourself as owner');
      return;
    }
    setFormData(prev => ({ ...prev, owners: prev.owners.filter(o => o.Id !== userId) }));
  };

  const handleSave = () => {
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      showNotification('error', 'End date must be after start date');
      return;
    }
    if (!formData.owners.some(o => o.Id === currentUser.Id)) {
      showNotification('error', 'Current user must remain an owner');
      return;
    }
    const digest = getRequestDigest();
    const ownersIds = formData.owners.map(o => o.Id);
    $.ajax({
      url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items(${survey.Id})`,
      type: 'POST',
      data: JSON.stringify({
        __metadata: { type: listItemType },
        StartDate: new Date(formData.startDate).toISOString(),
        EndDate: new Date(formData.endDate).toISOString(),
        Status: formData.status,
        OwnersId: { results: ownersIds }
      }),
      headers: {
        accept: 'application/json;odata=verbose',
        'content-type': 'application/json;odata=verbose',
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*',
        'X-RequestDigest': digest
      },
      success: () => {
        $.ajax({
          url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items(${survey.Id})/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)`,
          type: 'POST',
          headers: { 'X-RequestDigest': digest },
          success: () => {
            const addPerms = ownersIds.map(id => $.ajax({
              url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items(${survey.Id})/roleassignments/addroleassignment(principalid=${id},roledefid=${contributeRoleId})`,
              type: 'POST',
              headers: { 'X-RequestDigest': digest }
            }));
            $.when(...addPerms).then(() => {
              showNotification('success', 'Metadata updated');
              onSave();
            });
          },
          error: () => showNotification('error', 'Failed to set permissions')
        });
      },
      error: () => showNotification('error', 'Failed to update metadata')
    });
    onClose();
  };

  return e('div', { className: 'fixed z-[1200] inset-0 bg-black bg-opacity-50 flex items-center justify-center' },
    e('div', { className: 'bg-white p-4 rounded max-w-md w-full' },
      e('h2', null, 'Edit Metadata'),
      e('div', { className: 'mt-2' },
        e('label', null, 'Start Date:'),
        e('input', { type: 'date', value: formData.startDate, onChange: e => setFormData(prev => ({ ...prev, startDate: e.target.value })) })
      ),
      e('div', { className: 'mt-2' },
        e('label', null, 'End Date:'),
        e('input', { type: 'date', value: formData.endDate, onChange: e => setFormData(prev => ({ ...prev, endDate: e.target.value })) })
      ),
      e('div', { className: 'mt-2' },
        e('label', null, 'Status:'),
        e('select', { value: formData.status, onChange: e => setFormData(prev => ({ ...prev, status: e.target.value })) },
          e('option', null, 'Draft'),
          e('option', null, 'Published')
        )
      ),
      e('div', { className: 'mt-2' },
        e('label', null, 'Owners:'),
        e('div', { className: 'flex flex-wrap gap-1' },
          formData.owners.map(o => e('span', { key: o.Id, className: 'bg-blue-100 px-2 py-1 rounded flex items-center' },
            o.Title,
            o.Id && e('i', { className: 'fa fa-times ml-2 cursor-pointer', onClick: () => handleUserRemove(o.Id) })
          ))
        ),
        e('input', {
          type: 'text',
          placeholder: 'Search owners...',
          value: searchTerm,
          onChange: e => setSearchTerm(e.target.value),
          className: 'w-full p-2 border rounded mt-2'
        }),
        filteredUsers.length > 0 && e('div', { className: 'absolute z-10 bg-white border rounded mt-1 max-h-40 overflow-y-auto w-full' },
          filteredUsers.map(u => e('div', { key: u.Id, className: 'p-2 cursor-pointer hover:bg-gray-100', onClick: () => addUser(u) }, u.Title))
        )
      ),
      e('div', { className: 'mt-4 flex justify-end gap-2' },
        e('button', { className: 'bg-gray-500 text-white px-2 py-1', onClick: onClose }, 'Cancel'),
        e('button', { className: 'bg-blue-500 text-white px-2 py-1', onClick: handleSave }, 'Save')
      )
    )
  );
}

function NotificationItem({ type, message }) {
  let bgClass;
  switch (type) {
    case 'success': bgClass = 'bg-green-500'; break;
    case 'error': bgClass = 'bg-red-500'; break;
    case 'warning': bgClass = 'bg-yellow-500'; break;
    case 'info': bgClass = 'bg-blue-500'; break;
    default: bgClass = 'bg-gray-500';
  }
  return e('div', { className: `p-4 rounded text-white ${bgClass} mb-2` }, message);
}

function Notifications({ notifications }) {
  return e('div', { className: 'fixed top-4 right-4 z-[2000] flex flex-col' },
    notifications.map(n => e(NotificationItem, { key: n.id, type: n.type, message: n.message }))
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [responses, setResponses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [qrSurveyId, setQrSurveyId] = useState(null);
  const [deleteSurveyId, setDeleteSurveyId] = useState(null);
  const [editSurvey, setEditSurvey] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const showNotification = (type, message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications(prev => prev.filter(p => p.id !== id)), 5000);
  };

  const page = window.location.pathname.split('/').pop().toLowerCase();
  const isDashboard = page === 'dashboard.aspx';

  useEffect(() => {
    const hideSharePointElements = () => {
      const ribbon = document.getElementById('s4-ribbonrow');
      if (ribbon) ribbon.style.cssText = 'display: none !important';
      const titleRow = document.getElementById('s4-titlerow');
      if (titleRow) titleRow.style.cssText = 'display: none !important';
      const workspace = document.getElementById('s4-workspace');
      if (workspace) workspace.style.cssText = 'overflow: visible !important; position: static !important';
      const contentBox = document.getElementById('contentBox');
      if (contentBox) contentBox.style.cssText = 'margin-top: 0 !important; padding-top: 0 !important';
      console.log('SharePoint elements adjusted:', { ribbon: !!ribbon, titleRow: !!titleRow, workspace: !!workspace, contentBox: !!contentBox });
      console.log('Main z-index:', document.querySelector('.min-h-screen')?.style.zIndex);
      console.log('Create button z-index:', document.querySelector('.z-50')?.style.zIndex);
    };
    hideSharePointElements();
  }, []);

  useEffect(() => {
    if (!baseUrl) {
      showNotification('error', 'SharePoint context not loaded');
      return;
    }
    $.ajax({
      url: `${baseUrl}/_api/web/currentuser?$select=Id,Title`,
      headers: { accept: 'application/json;odata=verbose' },
      success: (data) => {
        console.log('Current user:', data.d);
        setCurrentUser(data.d);
      },
      error: () => showNotification('error', 'Failed to fetch current user')
    });
  }, []);

  const fetchSurveys = () => {
    $.ajax({
      url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items?$select=Id,Title,Owners/Id,Owners/Title,StartDate,EndDate,Status,AuthorId&$expand=Owners`,
      headers: { accept: 'application/json;odata=verbose' },
      success: (data) => {
        const surveys = data.d.results.map(s => ({
          ...s,
          Owners: s.Owners?.results || []
        }));
        console.log('Surveys:', surveys);
        setSurveys(surveys);
      },
      error: () => showNotification('error', 'Failed to fetch surveys')
    });
  };

  const fetchResponses = () => {
    $.ajax({
      url: `${baseUrl}/_api/web/lists/getbytitle('SurveyResponses')/items?$select=SurveyID`,
      headers: { accept: 'application/json;odata=verbose' },
      success: (data) => {
        console.log('Responses:', data.d.results);
        setResponses(data.d.results);
      },
      error: () => showNotification('error', 'Failed to fetch responses')
    });
  };

  useEffect(() => {
    if (currentUser) {
      fetchSurveys();
      fetchResponses();
    }
  }, [currentUser]);

  const responsesCount = responses.reduce((acc, r) => {
    const sid = r.SurveyID;
    acc[sid] = (acc[sid] || 0) + 1;
    return acc;
  }, {});

  const computeStatus = (s) => {
    if (s.Status === 'Draft') return 'Draft';
    if (s.Status === 'Published') {
      const now = new Date();
      const start = new Date(s.StartDate);
      const end = new Date(s.EndDate);
      if (start > now) return 'Upcoming';
      if (end >= now) return 'Running';
      return 'Published';
    }
    return s.Status;
  };

  const filteredSurveys = surveys.filter(s => {
    const titleMatch = s.Title.toLowerCase().includes(searchTerm.toLowerCase());
    let statusMatch = true;
    const compStatus = computeStatus(s);
    if (statusFilter === 'All') {
      statusMatch = true;
    } else if (statusFilter === 'Draft') {
      statusMatch = s.Status === 'Draft';
    } else if (statusFilter === 'Published') {
      statusMatch = s.Status === 'Published';
    } else if (statusFilter === 'Upcoming') {
      statusMatch = compStatus === 'Upcoming';
    } else if (statusFilter === 'Running') {
      statusMatch = compStatus === 'Running';
    }
    return titleMatch && statusMatch;
  });

  const createNewForm = () => {
    const digest = getRequestDigest();
    const today = new Date().toISOString().split('T')[0];
    $.ajax({
      url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items`,
      type: 'POST',
      data: JSON.stringify({
        __metadata: { type: listItemType },
        Title: 'New Survey',
        Status: 'Draft',
        OwnersId: { results: [currentUser.Id] },
        StartDate: today,
        EndDate: today
      }),
      headers: {
        accept: 'application/json;odata=verbose',
        'content-type': 'application/json;odata=verbose',
        'X-RequestDigest': digest
      },
      success: (data) => {
        const id = data.d.Id;
        $.ajax({
          url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items(${id})/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)`,
          type: 'POST',
          headers: { 'X-RequestDigest': digest },
          success: () => {
            $.ajax({
              url: `${baseUrl}/_api/web/lists/getbytitle('Surveys')/items(${id})/roleassignments/addroleassignment(principalid=${currentUser.Id},roledefid=${contributeRoleId})`,
              type: 'POST',
              headers: { 'X-RequestDigest': digest },
              success: () => {
                showNotification('success', 'Survey created');
                window.open(`builder.aspx?surveyId=${id}`, '_blank');
              },
              error: () => showNotification('error', 'Failed to set permissions')
            });
          },
          error: () => showNotification('error', 'Failed to break inheritance')
        });
      },
      error: () => showNotification('error', 'Failed to create survey')
    });
  };

  if (!currentUser) return e('div', null, 'Loading...');

  return e('div', null,
    e(TopNav, { currentUser, toggleSideNav: () => setIsSideNavOpen(!isSideNavOpen), isSideNavOpen }),
    isDashboard ? e('div', { className: 'flex pt-80 md:pt-0 !important' },
      e(SideNav, { isOpen: isSideNavOpen, setOpen: setIsSideNavOpen, searchTerm, setSearchTerm, statusFilter, setStatusFilter }),
      e('div', { className: 'flex-1 mt-80 md:mt-0 min-h-screen z-0 p-4' },
        e('button', { className: 'mb-4 bg-blue-600 text-white p-2 rounded z-50', onClick: createNewForm }, 'Create New Form'),
        e('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
          filteredSurveys.map(s => e(SurveyCard, {
            key: s.Id,
            survey: s,
            responsesCount,
            currentUserId: currentUser.Id,
            onEdit: setEditSurvey,
            onDelete: setDeleteSurveyId,
            onShowQR: setQrSurveyId
          }))
        )
      )
    ) : e('div', { className: 'mt-80 md:mt-0 min-h-screen z-0 p-4' }, `Placeholder for ${page}`),
    qrSurveyId && e(QRModal, { surveyId: qrSurveyId, onClose: () => setQrSurveyId(null), showNotification }),
    deleteSurveyId && e(DeleteModal, { surveyId: deleteSurveyId, onClose: () => setDeleteSurveyId(null), onConfirm: fetchSurveys, showNotification }),
    editSurvey && e(EditModal, { survey: editSurvey, onClose: () => setEditSurvey(null), onSave: fetchSurveys, currentUser, showNotification }),
    e(Notifications, { notifications })
  );
}

// Delay rendering until document and sp.js are ready
$(document).ready(function() {
  ExecuteOrDelayUntilScriptLoaded(function() {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      console.log('Root element found, rendering app');
      ReactDOM.createRoot(rootElement).render(e(App));
    } else {
      console.error('Root element not found');
    }
  }, 'sp.js');
});