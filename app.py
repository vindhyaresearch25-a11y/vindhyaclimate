"""
Streamlit app for MP Climate Intelligence Dashboard.

Data strategy: Keep HTML sent over WebSocket small.  Patch all data-file
URLs to point to GitHub raw CDN — the browser fetches large data at
runtime, just like it fetches Chart.js / Leaflet from CDN.
"""
import streamlit as st
import os

st.set_page_config(page_title="MP Climate Intelligence", layout="wide", page_icon="🌾")

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), 'dashboard')
GITHUB_RAW = "https://raw.githubusercontent.com/vindhyaresearch25-a11y/vindhyaclimate/main/dashboard/data"

_URL_PATCHES = [
    ("'data/mp_climate_data.json'",        f"'{GITHUB_RAW}/mp_climate_data.json'"),
    ("'data/dicra_ndvi.json'",             f"'{GITHUB_RAW}/dicra_ndvi.json'"),
    ("'data/forecast_2040.json'",          f"'{GITHUB_RAW}/forecast_2040.json'"),
    ("'data/cadastral_kundam.geojson'",    f"'{GITHUB_RAW}/cadastral_kundam.geojson'"),
    ("'data/villages_",                    f"'{GITHUB_RAW}/villages_"),
]


@st.cache_resource
def get_html_content():
    with open(os.path.join(DASHBOARD_DIR, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()

    for old, new in _URL_PATCHES:
        if old in html:
            html = html.replace(old, new)

    # Fix viewport for iframe rendering
    html = html.replace(
        'html,body{height:100%;overflow:hidden;}',
        'html,body{height:100%;width:100%;overflow:hidden;margin:0;padding:0;}'
    )
    html = html.replace(
        '#hero{position:relative;min-height:100%',
        '#hero{position:relative;min-height:600px'
    )
    return html


def _esc_srcdoc(s):
    """Escape a string for use in an HTML srcdoc attribute.

    Within an srcdoc attribute, the browser decodes HTML entities and then
    parses the result as a new document.  We must protect both `&` (so URL
    query strings and bare ampersands in JS aren't misinterpreted) and `"`
    (so the attribute delimiter isn't broken).  The order matters: & first,
    " second, so that the &quot; we introduce stays intact.
    """
    return s.replace('&', '&amp;').replace('"', '&quot;')


def main():
    st.markdown("""
        <style>
        .stApp, .stApp > div, .block-container {
            margin: 0 !important; padding: 0 !important;
            max-width: 100% !important; width: 100% !important;
        }
        #main-menu, header, footer { display: none !important; }
        .appview-container, .main, .stApp {
            position: fixed; top: 0; left: 0;
            width: 100vw !important; height: 100vh !important;
            overflow: hidden !important;
        }
        iframe.dash-frame {
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            border: none; z-index: 999999;
        }
        </style>
    """, unsafe_allow_html=True)

    html = get_html_content()
    st.markdown(
        f'<iframe class="dash-frame" srcdoc="{_esc_srcdoc(html)}"></iframe>',
        unsafe_allow_html=True,
    )


if __name__ == '__main__':
    main()
