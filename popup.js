function bId(id) {
	return document.getElementById(id);
}

function hide(id) {
	bId(id).style.display = 'none';
}

function show(id) {
	bId(id).style.display = '';
}


function cC(id_) {
	var c = document.createElement("input");
}

/*
https://www.facebook.com/photo.php?fbid=1679596962056722&set=pcb.436765463336727&type=3
https://www.facebook.com/photo.php?fbid=1676383735711378&set=gm.435385996808007&type=3
Videos
https://www.facebook.com/martin.majlis/videos/pcb.446342962378977/10210634986085218/?type=3
https://www.facebook.com/martin.majlis/videos/pcb.446342962378977/10210634993165395/?type=3
https://www.facebook.com/martin.majlis/videos/10210656631826348/?ref=notif&notif_t=video_processed&notif_id=1493189647191248
*/

function extractFbId(href) {
	regexs = {
		'photo': [
			/photo\.php\?fbid=([0-9]+)/
		],
		'video': [
			/videos\/[a-z]+\.[0-9]+\/([0-9]+)\//,
			/videos\/([0-9]+)\//,
		]
	}

	for (var key in regexs) {
		for (var i in regexs[key]) {
			var regex = regexs[key][i];
			regex_match = href.match(regex);
			if (regex_match) {
				return { id: regex_match[1], type: key }
			}
		}
	}

	return undefined;
}

function appendLink(parent, href) {
	fbid = extractFbId(href);
	if (! fbid) {
		console.error("Cannot extract fbid from " + href);
		return;
	}

	var tr = document.createElement("tr");
	fbid = extractFbId(href);
	cb = document.createElement("input");

	cb.setAttribute("name", "cb_" + fbid.id);
	cb.setAttribute("url", href);
	cb.setAttribute("url_type", fbid.type);
	cb.setAttribute("fbid", fbid.id);
	cb.setAttribute("type", "checkbox");
	cb.checked = true;

	var td1 = document.createElement("td");
	td1.appendChild(cb);
	tr.appendChild(td1);

	a = document.createElement("a");
	a.href = href;
	a.appendChild(document.createTextNode(fbid.id));
	var td2 = document.createElement("td");
	td2.appendChild(a);
	tr.appendChild(td2);

	parent.appendChild(tr);
}



function appendLinks(parent_id, links) {
	var parent = bId(parent_id);

	while (parent.hasChildNodes()) {
		parent.removeChild(parent.lastChild);
	}

	for (i = 0; i < links.length; i++) {
		appendLink(parent, links[i]);
	}
}

function extractLinks(tabs) {
	hide("notgroup");
	show("ingroup");
	show("goto_photos");
	show("goto_videos");
	// hide("extract");
	show("results");

	chrome.tabs.sendMessage(
		tabs[0].id,
		{m: 'extract_links'},
		function(response){

			if (! response) {
				console.error("Somethign went wrong - no response!");
				console.dir(response);
				return;
			}

			if (! response.hasOwnProperty("links")) {
				console.error("Somethign went wrong - no links!");
				console.dir(response);
				return;
			}

			links = response.links;
			videos = links.filter(function(s) { return s.indexOf("video") !== -1; });
			if (videos.length > 0) {
				appendLinks("tableresults", videos);
			} else {
				photos = links.filter(function(s) { return s.indexOf("photo") !== -1; });
				appendLinks("tableresults", photos);
			}
		}
	);

}


function constructFileNamePrefix(fbid, ts) {
	var d = new Date(ts * 1000);
	var iso = d.toISOString().replace(/[:.]/g, "-").replace("-000Z", "");
	return iso + "_" + fbid;
}


function extractTimeStamp(txt) {
	// data-utime="1493189486"
	m = txt.match(/data-utime="([0-9]+)"/);
	return m ? m[1] : 0
}

function downloadVideos(fbid, txt) {
	var ts = extractTimeStamp(txt);
	var prefix = constructFileNamePrefix(fbid, ts);

	sd_src = txt.match(/sd_src:"([^"]+)"/);
	if (sd_src) {
		chrome.downloads.download({
			url: sd_src[1],
			filename: prefix + "_sd.mp4",
			conflictAction: "prompt"
		});
		console.log("sd_src: " + sd_src[1]);
	}

	hd_src = txt.match(/hd_src:"([^"]+)"/);
	if (hd_src) {
		chrome.downloads.download({
			url: hd_src[1],
			filename: prefix + "_hd.mp4",
			conflictAction: "prompt"
		});
		console.log("hd_src: " + hd_src[1]);
	}
}

function downloadPhoto(fbid, txt) {
	var ts = extractTimeStamp(txt);
	var prefix = constructFileNamePrefix(fbid, ts);
 	src = txt.match(/data-ploi="([^"]+)"/);
	if (src) {
		/*
		console.log(src[1]);
		console.log(decodeURIComponent(src[1]));
		console.log(decodeURI(src[1]));
		*/
		chrome.downloads.download({
			url: src[1].replace(/amp;/g, ""),
			filename: prefix + ".jpg",
			conflictAction: "prompt"
		});
		console.log("img_src: " + src[1]);
	}

}




function downloadAll() {
	inputs = document.getElementsByTagName("input");
	for (i = 0; i < inputs.length; i++) {
	    inp = inputs[i];
	    if (
				inp.hasAttribute("type") &&
				inp.getAttribute("type") === "checkbox" &&
				inp.hasAttribute("url_type") &&
				inp.hasAttribute("url") &&
				inp.checked
			) {
				url = inp.getAttribute("url");
				url_type = inp.getAttribute("url_type");
				fbid = inp.getAttribute("fbid");

				var xhr = new XMLHttpRequest();
				xhr.open("GET", url, true);
				//xhr.setRequestHeader("Content-Type","application/json");
				//xhr.send(JSON.stringify(data));
				xhr.onreadystatechange = function() {
				  if (xhr.readyState == 4) {
						var res = {};
						if (url_type === "video") {
							res = downloadVideos(fbid, xhr.responseText);
						} else if (url_type === "photo") {
							res = downloadPhoto(fbid, xhr.responseText);
						} else {
							console.error("Unsupported url_type: " + url_type);
						}
						console.dir(res);


						console.dir(xhr);
				  }
				}
				xhr.send();
	    }
	}
}


function updateButtons(tabs, group_id) {

	chrome.tabs.onUpdated.addListener(
		function(tabId, changeInfo, tab) {
			console.log("chrome.tabs.onUpdated - " + tabId + " - " + tab.status);
			if (tab.status == "complete") {
				extractLinks([tab]);
			}
		}
	);

	var base_url = "https://www.facebook.com/groups/" + group_id + "/";
	document.querySelector('#goto_photos').addEventListener(
		'click',
		function() {
			chrome.tabs.update(
				tabs[0].id,
				{ url: base_url + "photos/" }
			);
		}
	);
	document.querySelector('#goto_videos').addEventListener(
		'click',
		function() {
			chrome.tabs.update(
				tabs[0].id,
				{ url: base_url + "videos/" }
			);
		}
	);

	document.querySelector('#download').addEventListener(
		'click',
		downloadAll
	);

}


document.addEventListener(
	'DOMContentLoaded',
	function() {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			// console.log("Calling chrome.tabs.sendMessage");
    	chrome.tabs.sendMessage(
				tabs[0].id,
				{m: 'current_url'},
				function(response){
					// now we should show/hide proper buttons
					// console.dir(response);
					var url = response.url
					var group_regex = /facebook\.com\/groups\/([0-9]+)\//

					regex_match = url.match(group_regex);
					if (regex_match) {
						// we are in group now
						show("ingroup");
						hide("notgroup");
						var group_id = regex_match[1];

						updateButtons(tabs, group_id);


						var is_photo = url.match(/\/groups\/([0-9]+)\/photos/);
						var is_video = url.match(/\/groups\/([0-9]+)\/videos/);
						if (is_photo || is_video) {
							//hide("goto_photos");
							//hide("goto_videos");
							extractLinks(tabs);
						} else {
							// hide("extract");
							hide("results");

						}
					} else {
						show("notgroup");
						hide("ingroup");
					}
				}
			);
		});
	}
);
