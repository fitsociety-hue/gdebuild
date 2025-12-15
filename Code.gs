function doGet(e) {
  // Safeguard: If run manually in the editor, 'e' is undefined.
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "This script is meant to be accessed as a Web App (doGet). Event object 'e' is missing."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var action = e.parameter.action;
  
  // CORS Header
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  if (action === "get") {
    var id = e.parameter.id;
    var data = getPageById(id);
    if (data) {
      output.setContent(JSON.stringify({ status: "success", data: data }));
    } else {
      output.setContent(JSON.stringify({ status: "error", message: "Page not found" }));
    }
  } else if (action === "list") {
    var list = getProjectList();
    output.setContent(JSON.stringify({ status: "success", data: list }));
  } else {
    output.setContent(JSON.stringify({ status: "error", message: "Invalid action" }));
  }
  
  return output;
}

function doPost(e) {
  // Safeguard: If run manually in the editor, 'e' is undefined.
  if (!e || !e.postData) {
     return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "This script is meant to be accessed as a Web App (doPost). Event object 'e' is missing."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    
    if (action === "save") {
      var result = savePage(params);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "delete") {
      var result = deletePage(params);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Unknown action"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- DATABASE LOGIC (Spreadsheet) ---

function getSpreadsheet() {
  var files = DriveApp.getFilesByName("MobileBuilderDB");
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  } else {
    var ss = SpreadsheetApp.create("MobileBuilderDB");
    ss.getSheets()[0].appendRow(["ID", "Title", "Password", "Data", "CreatedAt", "Author", "Category"]);
    return ss;
  }
}

function savePage(params) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  
  // UPDATE existing page
  if (params.id) {
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] == params.id) {
            // Password verification
            if (data[i][2] != params.password) {
                return { status: "error", message: "Incorrect password" };
            }
            
            // Update inputs: Title(Col 1), Data(Col 3), Timestamp(Col 4)
            sheet.getRange(i + 1, 2).setValue(params.title || data[i][1]);
            sheet.getRange(i + 1, 4).setValue(params.data);
            sheet.getRange(i + 1, 5).setValue(now);
            sheet.getRange(i + 1, 6).setValue(params.author || data[i][5]);
            sheet.getRange(i + 1, 7).setValue(params.category || data[i][6]);
            
            return { status: "success", id: params.id, message: "Updated successfully" };
        }
    }
    return { status: "error", message: "Page ID not found for update" };
  }
  
  // CREATE new page
  var id = Utilities.getUuid();
  sheet.appendRow([
    id, 
    params.title || "Untitled",
    params.password, 
    params.data, 
    now,
    params.author,
    params.category
  ]);
  
  return { status: "success", id: id, message: "Created successfully" };
}

function deletePage(params) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] == params.id) {
            if (data[i][2] != params.password) {
                return { status: "error", message: "Incorrect password" };
            }
            
            sheet.deleteRow(i + 1);
            return { status: "success", message: "Deleted successfully" };
        }
    }
    return { status: "error", message: "Page not found" };
}

function getPageById(id) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  
  // Skip header, search for ID in column 0
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      return {
        id: data[i][0],
        title: data[i][1],
        // password: data[i][2], // Never return password
        data: data[i][3],
        createdAt: data[i][4],
        author: data[i][5],
        category: data[i][6]
      };
    }
  }
  return null;
}

function getProjectList() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var list = [];
  
  // Skip header, iterate to collect metadata only
  for (var i = 1; i < data.length; i++) {
    list.push({
      id: data[i][0],
      title: data[i][1],
      createdAt: data[i][4],
      author: data[i][5],
      category: data[i][6]
    });
  }
  
  // Return most recent first
  return list.reverse();
}