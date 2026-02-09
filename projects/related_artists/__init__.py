import discogs_client
from flask import Blueprint, render_template, request, jsonify, Response
from collections import defaultdict
import json
import os
import re
from datetime import datetime, timedelta
import threading
import queue

PROJECT_META = {
    'id': 'related-artists',
    'name': 'Related Artists',
    'description': 'Discover connections between musical artists by exploring collaborator networks using Discogs data.',
    'icon': 'music',
    'color': '#e11d48',
    'category': 'Data Exploration',
    'nav_group': 'Data & Visualization',
    'tags': ['discogs', 'music', 'graph', 'api', 'streaming'],
}

bp = Blueprint(
    'related_artists',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/related-artists',
)

# Initialize Discogs client
_discogs = discogs_client.Client(
    os.environ.get('DISCOGS_USER_AGENT', 'MLHub/1.0'),
    user_token=os.environ.get('DISCOGS_USER_TOKEN', 'wuJcrmLQnTCCwtsqYUWFonxTZOuaPnLNSgyBzhYd'),
)

# Cache configuration
_CACHE_DIR = os.path.dirname(__file__)
CACHE_FILE = os.path.join(_CACHE_DIR, 'artist_cache.json')
CACHE_DURATION_DAYS = 7

# Processing configuration
MAX_RELEASES = 100
BATCH_SIZE = 12

# Store active searches to allow cancellation
active_searches = {}
pause_events = {}


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_cache(cache):
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f)
    except Exception:
        pass


def get_cached_result(artist_name):
    cache = load_cache()
    cache_key = artist_name.lower()
    if cache_key in cache:
        cached_data = cache[cache_key]
        cached_time = datetime.fromisoformat(cached_data['timestamp'])
        if datetime.now() < cached_time + timedelta(days=CACHE_DURATION_DAYS):
            return cached_data['data']
    return None


def cache_result(artist_name, data):
    cache = load_cache()
    cache[artist_name.lower()] = {
        'timestamp': datetime.now().isoformat(),
        'data': data,
    }
    save_cache(cache)


# ---------------------------------------------------------------------------
# Discogs helpers
# ---------------------------------------------------------------------------

def get_artist_image(artist_id):
    try:
        if not artist_id:
            return ''
        artist_obj = _discogs.artist(artist_id)
        if hasattr(artist_obj, 'images') and artist_obj.images:
            return artist_obj.images[0]['uri150']
    except Exception:
        pass
    return ''


def normalize_role(role):
    role_mapping = {
        'featuring': 'Guests',
        'featuring artist': 'Guests',
        'guest': 'Guests',
        'guitar': 'Guests',
        'guitars': 'Guests',
    }
    return role_mapping.get(role.lower(), role.title())


# ---------------------------------------------------------------------------
# Core extraction logic (streaming with pause/resume)
# ---------------------------------------------------------------------------

def extract_collaborators_async(artist_name, progress_callback, search_id, pause_event):
    try:
        progress_callback(5, 'Searching for artist...')
        results = _discogs.search(artist_name, type='artist')

        if search_id not in active_searches or not active_searches[search_id]:
            return None, None, {}, None, False

        artist_id = None
        artist_url = None
        main_artist_image = ''

        for page in results:
            if page.name.lower() == artist_name.lower() and page.name.lower() != 'various':
                artist_id = page.id
                artist_url = page.url
                if hasattr(page, 'data') and 'cover_image' in page.data:
                    main_artist_image = page.data['cover_image']
                break

        if not artist_id:
            if len(results) > 0:
                artist_id = results[0].id
                artist_url = results[0].url
                if hasattr(results[0], 'data') and 'cover_image' in results[0].data:
                    main_artist_image = results[0].data['cover_image']
            else:
                return None, None, {}, None, False

        progress_callback(10, f'Found artist (ID: {artist_id})')

        if search_id not in active_searches or not active_searches[search_id]:
            return None, None, {}, None, False

        artist = _discogs.artist(artist_id)
        actual_artist_name = artist.name
        artist_members = artist.members

        schema_data = {
            '@context': 'http://schema.org',
            '@type': 'MusicGroup',
            '@id': artist_url,
            'name': actual_artist_name,
            'image': main_artist_image,
            'description': artist.profile if hasattr(artist, 'profile') else '',
            'member': [{'@type': 'Person', '@id': artist_url, 'name': actual_artist_name}],
            'memberOf': [],
        }

        progress_callback(
            12,
            f'Found {actual_artist_name}, fetching releases...',
            artist_info={
                'name': actual_artist_name,
                'url': artist_url,
                'schema': schema_data,
            },
        )

        relations_dict = defaultdict(lambda: defaultdict(lambda: {'id': None, 'releases': [], 'image': ''}))

        progress_callback(15, 'Fetching releases...')
        all_releases = list(artist.releases)
        releases = all_releases[:MAX_RELEASES]
        total_releases = len(releases)

        if len(all_releases) > MAX_RELEASES:
            progress_callback(18, f'Processing first {MAX_RELEASES} of {len(all_releases)} releases...')

        if search_id not in active_searches or not active_searches[search_id]:
            return None, None, {}, None, False

        release_count = 0
        streamed_collaborators = {}
        batch_count = 0

        for release in releases:
            if search_id not in active_searches or not active_searches[search_id]:
                return None, None, {}, None, False

            release_data = release.data
            release_artist = release_data.get('artist', '')
            release_year = release_data.get('year', 'Unknown')
            release_count += 1

            progress_percent = 15 + (release_count / total_releases * 60)
            progress_callback(progress_percent, f'Fetching from Discogs... ({release_count}/{total_releases})')

            try:
                tracklist = release.tracklist
                for track in tracklist:
                    track_data = track.data
                    if 'extraartists' not in track_data:
                        continue

                    if release_artist == actual_artist_name:
                        for extra_artist in track_data['extraartists']:
                            role = 'Guests'
                            collab_name = extra_artist.get('name', 'Unknown')
                            collab_id = extra_artist.get('id')

                            if collab_id and collab_name not in (actual_artist_name, 'Various'):
                                relations_dict[role][collab_name]['id'] = collab_id
                                master_id = release_data.get('master_id') or release.id
                                track_info = (track.title, release_year, master_id)
                                if track_info not in relations_dict[role][collab_name]['releases']:
                                    relations_dict[role][collab_name]['releases'].append(track_info)

                                    collab_key = f'{role}:{collab_name}'
                                    if collab_key not in streamed_collaborators:
                                        streamed_collaborators[collab_key] = True
                                        sorted_rels = sorted(
                                            relations_dict[role][collab_name]['releases'],
                                            key=lambda x: x[1] if x[1] != 'Unknown' else 0,
                                            reverse=True,
                                        )
                                        first_release_id = sorted_rels[0][2] if sorted_rels else None
                                        parts = [f'{t} ({y})' for t, y, _ in sorted_rels[:3]]
                                        release_str = f"{', '.join(parts)} feat. {collab_name}"
                                        if len(sorted_rels) > 3:
                                            release_str += f' (and {len(sorted_rels) - 3} more)'

                                        progress_callback(
                                            progress_percent,
                                            f'Fetching from Discogs... ({release_count}/{total_releases})',
                                            collaborator={
                                                'role': role,
                                                'name': collab_name,
                                                'id': collab_id,
                                                'release_id': first_release_id,
                                                'releases': release_str,
                                                'image': '',
                                            },
                                        )

                                        batch_count += 1
                                        if batch_count >= BATCH_SIZE:
                                            progress_callback(
                                                progress_percent,
                                                f'Found {len(streamed_collaborators)} collaborators so far',
                                                pause=True,
                                            )
                                            pause_event.clear()
                                            pause_event.wait()
                                            if search_id not in active_searches or not active_searches[search_id]:
                                                return None, None, {}, None, False
                                            batch_count = 0

                    if release_artist != actual_artist_name:
                        for extra_artist2 in track_data['extraartists']:
                            if extra_artist2.get('name') == actual_artist_name:
                                role = 'Appearances'
                                collab_name = release_artist
                                collab_id = None
                                try:
                                    artist_search = _discogs.search(release_artist, type='artist')
                                    if len(artist_search) > 0:
                                        collab_id = artist_search[0].id
                                except Exception:
                                    pass

                                if collab_id and collab_name not in (actual_artist_name, 'Various'):
                                    relations_dict[role][collab_name]['id'] = collab_id
                                    master_id = release_data.get('master_id') or release.id
                                    track_info = (track.title, release_year, master_id)
                                    if track_info not in relations_dict[role][collab_name]['releases']:
                                        relations_dict[role][collab_name]['releases'].append(track_info)

                                        collab_key = f'{role}:{collab_name}'
                                        if collab_key not in streamed_collaborators:
                                            streamed_collaborators[collab_key] = True
                                            sorted_rels = sorted(
                                                relations_dict[role][collab_name]['releases'],
                                                key=lambda x: x[1] if x[1] != 'Unknown' else 0,
                                                reverse=True,
                                            )
                                            first_release_id = sorted_rels[0][2] if sorted_rels else None
                                            parts = [f'{t} ({y})' for t, y, _ in sorted_rels[:3]]
                                            release_str = f"{', '.join(parts)} feat. {artist_name}"
                                            if len(sorted_rels) > 3:
                                                release_str += f' (and {len(sorted_rels) - 3} more)'

                                            progress_callback(
                                                progress_percent,
                                                f'Fetching from Discogs... ({release_count}/{total_releases})',
                                                collaborator={
                                                    'role': role,
                                                    'name': collab_name,
                                                    'id': collab_id,
                                                    'release_id': first_release_id,
                                                    'releases': release_str,
                                                    'image': '',
                                                },
                                            )

                                            batch_count += 1
                                            if batch_count >= BATCH_SIZE:
                                                progress_callback(
                                                    progress_percent,
                                                    f'Found {len(streamed_collaborators)} collaborators so far',
                                                    pause=True,
                                                )
                                                pause_event.clear()
                                                pause_event.wait()
                                                if search_id not in active_searches or not active_searches[search_id]:
                                                    return None, None, {}, None, False
                                                batch_count = 0

            except Exception:
                continue

        if search_id not in active_searches or not active_searches[search_id]:
            return None, None, {}, None, False

        progress_callback(90, 'Finalizing results...')

        cleaned_artist_members = [m.name for m in artist_members]

        relations = {}
        for role, artists in relations_dict.items():
            relations[role] = []
            for collab_name, info in artists.items():
                sorted_releases = sorted(
                    info['releases'],
                    key=lambda x: x[1] if x[1] != 'Unknown' else 0,
                    reverse=True,
                )
                first_release_id = sorted_releases[0][2] if sorted_releases else None

                if collab_name in cleaned_artist_members:
                    member_role = 'Member'
                    parts = [f'{t} ({y})' for t, y, _ in sorted_releases[:3]]
                    release_str = ', '.join(parts)
                    if len(sorted_releases) > 3:
                        release_str += f' (and {len(sorted_releases) - 3} more)'

                    if member_role not in relations:
                        relations[member_role] = []

                    member_data = {
                        'name': collab_name,
                        'id': info['id'],
                        'release_id': first_release_id,
                        'releases': release_str,
                        'image': info['image'],
                    }
                    relations[member_role].append(member_data)

                    collab_key = f'{member_role}:{collab_name}'
                    if collab_key not in streamed_collaborators:
                        streamed_collaborators[collab_key] = True
                        progress_callback(90, 'Finalizing results...', collaborator={'role': member_role, **member_data})
                else:
                    if role == 'Guests':
                        parts = [f'{t} ({y})' for t, y, _ in sorted_releases[:3]]
                        release_str = f"{', '.join(parts)} feat. {collab_name}"
                    else:
                        parts = [f'{t} ({y})' for t, y, _ in sorted_releases[:3]]
                        release_str = f"{', '.join(parts)} feat. {artist_name}"
                    if len(sorted_releases) > 3:
                        release_str += f' (and {len(sorted_releases) - 3} more)'

                    relations[role].append({
                        'name': collab_name,
                        'id': info['id'],
                        'release_id': first_release_id,
                        'releases': release_str,
                        'image': info['image'],
                    })

            relations[role].sort(key=lambda x: x['name'].lower())

        progress_callback(100, 'Complete!')
        return actual_artist_name, artist_url, relations, schema_data, len(all_releases) > MAX_RELEASES

    except Exception:
        import traceback
        traceback.print_exc()
        return None, None, {}, None, False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.route('/')
def index():
    return render_template('related_artists/index.html')


@bp.route('/search_stream')
def search_stream():
    artist_name = request.args.get('artist', '').strip()
    search_id = request.args.get('search_id', '')

    def generate():
        if not artist_name:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Artist name is required'})}\n\n"
            return

        active_searches[search_id] = True

        try:
            cached_result = get_cached_result(artist_name)
            if cached_result:
                yield f"data: {json.dumps({'type': 'cached', 'result': {**cached_result, 'from_cache': True}})}\n\n"
                return

            progress_queue = queue.Queue()
            pause_event = threading.Event()
            pause_event.set()
            pause_events[search_id] = pause_event

            def threaded_process():
                def callback(percent, message, collaborator=None, pause=False, artist_info=None):
                    if artist_info:
                        progress_queue.put(('ARTIST_INFO', percent, message, artist_info))
                    if collaborator:
                        progress_queue.put(('COLLABORATOR', percent, message, collaborator))
                    if pause:
                        progress_queue.put(('PAUSED', percent, message))
                    elif not collaborator and not artist_info:
                        progress_queue.put(('PROGRESS', percent, message))

                result = extract_collaborators_async(artist_name, callback, search_id, pause_event)
                progress_queue.put(('DONE', result))

            thread = threading.Thread(target=threaded_process)
            thread.start()

            while True:
                try:
                    item = progress_queue.get(timeout=0.5)
                    if item[0] == 'DONE':
                        artist_display_name, discogs_url, relations, schema_data, limited_results = item[1]

                        if not artist_display_name or search_id not in active_searches or not active_searches[search_id]:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Search cancelled or artist not found'})}\n\n"
                            break

                        result = {
                            'artist': artist_display_name,
                            'discogs_url': discogs_url,
                            'relations': relations,
                            'total_relations': sum(len(a) for a in relations.values()),
                            'schema': schema_data,
                            'from_cache': False,
                            'limited_results': limited_results,
                        }

                        cache_result(artist_name, {
                            'artist': artist_display_name,
                            'discogs_url': discogs_url,
                            'relations': relations,
                            'total_relations': result['total_relations'],
                            'schema': schema_data,
                            'limited_results': limited_results,
                        })

                        yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
                        break
                    elif item[0] == 'ARTIST_INFO':
                        _, percent, message, artist_info = item
                        yield f"data: {json.dumps({'type': 'artist_info', 'progress': percent, 'message': message, 'artist_info': artist_info})}\n\n"
                    elif item[0] == 'PAUSED':
                        _, percent, message = item
                        yield f"data: {json.dumps({'type': 'paused', 'progress': percent, 'message': message})}\n\n"
                    elif item[0] == 'COLLABORATOR':
                        _, percent, message, collaborator = item
                        yield f"data: {json.dumps({'type': 'collaborator', 'progress': percent, 'message': message, 'collaborator': collaborator})}\n\n"
                    else:
                        _, percent, message = item
                        yield f"data: {json.dumps({'type': 'progress', 'progress': percent, 'message': message})}\n\n"
                except queue.Empty:
                    yield ': keepalive\n\n'
                    if search_id not in active_searches or not active_searches[search_id]:
                        break

            thread.join(timeout=1)

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': f'Error: {str(e)}'})}\n\n"
        finally:
            active_searches.pop(search_id, None)
            pause_events.pop(search_id, None)

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )


@bp.route('/cancel', methods=['POST'])
def cancel():
    data = request.json
    search_id = data.get('search_id', '')
    if search_id in active_searches:
        active_searches[search_id] = False
        if search_id in pause_events:
            pause_events[search_id].set()
        return jsonify({'status': 'cancelled'})
    return jsonify({'status': 'not_found'})


@bp.route('/resume', methods=['POST'])
def resume():
    data = request.json
    search_id = data.get('search_id', '')
    if search_id in pause_events:
        pause_events[search_id].set()
        return jsonify({'status': 'resumed'})
    return jsonify({'status': 'not_found'})


@bp.route('/fetch_image/<int:artist_id>')
def fetch_image(artist_id):
    try:
        image_url = get_artist_image(artist_id)
        if not image_url:
            release_id = request.args.get('release_id', type=int)
            if release_id:
                try:
                    release = _discogs.release(release_id)
                    if hasattr(release, 'data') and 'thumb' in release.data and release.data['thumb']:
                        image_url = release.data['thumb']
                except Exception:
                    pass
        return jsonify({'image': image_url or 'https://via.placeholder.com/200x200?text=No+Image'})
    except Exception:
        return jsonify({'image': 'https://via.placeholder.com/200x200?text=No+Image'})


@bp.route('/fetch_release_image/<int:release_id>')
def fetch_release_image(release_id):
    try:
        image_url = ''
        try:
            master = _discogs.master(release_id)
            if hasattr(master, 'data') and 'images' in master.data and master.data['images']:
                image_url = master.data['images'][0]['uri150']
            elif hasattr(master, 'images') and master.images:
                image_url = master.images[0]['uri150']
        except Exception:
            try:
                release = _discogs.release(release_id)
                if hasattr(release, 'data') and 'thumb' in release.data:
                    image_url = release.data['thumb']
                if not image_url and hasattr(release, 'images') and release.images:
                    image_url = release.images[0]['uri150']
            except Exception:
                pass

        if not image_url:
            return jsonify({'image': '', 'error': 'no_image'})
        return jsonify({'image': image_url})
    except Exception:
        return jsonify({'image': '', 'error': 'unknown'})
