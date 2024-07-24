const SCRIPT_REGEX = /^<script crossorigin src="(https:\/\/a-v2.sndcdn.com\/assets\/0-[^"]+\.js)"><\/script>$/m;
const CLIENT_ID_REGEX = /client_id:"([^"]*)"/

interface Env {
    SOUNDCLOUD: KVNamespace
}

async function updateClientID(kv: KVNamespace) {
    const sc = await fetch("https://soundcloud.com");
    const scriptURL = SCRIPT_REGEX.exec(await sc.text())[1];
    const script = await fetch(scriptURL);
    const clientID = CLIENT_ID_REGEX.exec(await script.text())[1];
    await kv.put("client_id", clientID);
}

async function resolveURL(kv: KVNamespace, url: string): Promise<any> {
    const apiURL = new URL("https://api-v2.soundcloud.com/resolve");
    const clientID = await kv.get("client_id");
    apiURL.searchParams.set("client_id", clientID);
    apiURL.searchParams.set("url", url);
    const response = await fetch(apiURL);
    if (response.status === 401) {
        // need new client_id
        await updateClientID(kv);
        return await resolveURL(kv, url);
    }
    return await response.json();
}

function getFullQualityArtworkURL(resource: any): string {
    const url = resource.artwork_url || resource.user.avatar_url;
    const x = url.split("-");
    x[x.length - 1] = "t500x500.jpg";
    return x.join("-");
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const page = context.params.page as string[] || [];
    const scURL = "https://soundcloud.com/" + page.join("/");

    if (page.length !== 2) {
        return Response.redirect(scURL, 302);
    }
    const resource = await resolveURL(context.env.SOUNDCLOUD, scURL);
    if (resource.kind !== "track" && resource.kind !== "playlist") {
        return Response.redirect(scURL, 302);
    }

    console.log(resource);

    let html = `<head>`;
    html += `<meta content="SoundCloud" property="twitter:site">`;
    html += `<meta property="twitter:title" content="${resource.title}">`;
    html += `<meta property="twitter:card" content="player">`;
    html += `<meta property="twitter:player" content="https://w.soundcloud.com/player/?url=${encodeURIComponent(resource.uri)}&amp;color=000000&amp;auto_play=false&amp;visual=true&amp;show_artwork=true&amp;hide_related=true">`;
    html += `<meta property="twitter:url" content="${resource.permalink_url}">`;
    html += `<meta property="twitter:player:height" content="120">`;
    html += `<meta property="twitter:player:width" content="435">`;
    html += `<meta property="twitter:image" content="${getFullQualityArtworkURL(resource)}">`;
    html += `<link rel="alternate" type="text/json+oembed" href="https://soundcloud.com/oembed?url=${encodeURIComponent(resource.uri)}&amp;format=json">`;
    html += `<meta http-equiv="refresh" content="0;url=${resource.permalink_url}">`;
    html += `</head>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      }
    });
}