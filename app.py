"""
Streamlit app for MP Climate Intelligence Dashboard.

Strategy:  Use st.components.v1.html() (safe sandboxed iframe) with a
large initial height.  All data files are fetched from GitHub raw CDN;
nothing is inlined, so the WebSocket message stays small.
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


def main():
    # Hide Streamlit chrome
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
        iframe[title="streamlit-component-iframe"] {
            width: 100vw !important;
            height: 100vh !important;
            border: none !important;
        }
        </style>
    """, unsafe_allow_html=True)

    html = get_html_content()
    st.components.v1.html(html, height=800, scrolling=False)


if __name__ == '__main__':
    main()
