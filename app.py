"""
Streamlit app for MP Climate Intelligence Dashboard.
Usage: streamlit run app.py
"""
import streamlit as st
import json, os, base64

st.set_page_config(page_title="MP Climate Intelligence", layout="wide", page_icon="🌾")

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), 'dashboard')

def load_data_inline():
    """Inline JSON data files into the HTML to avoid CORS/fetch issues on Streamlit."""
    data_files = {
        'mp_climate_data.json': 'window._MERGED_CLIMATE_DATA',
        'forecast_2040.json': 'window._MERGED_FORECAST_DATA',
        'dicra_ndvi.json': 'window._MERGED_NDVI_DATA',
    }
    js_parts = []
    for fname, var_name in data_files.items():
        fpath = os.path.join(DASHBOARD_DIR, 'data', fname)
        if os.path.exists(fpath):
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            js_parts.append(f'{var_name} = {json.dumps(data)};')
    return '<script>' + '\n'.join(js_parts) + '</script>'

@st.cache_resource
def get_html_content():
    index_path = os.path.join(DASHBOARD_DIR, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()
    # Inject inline data script before closing head
    inline_data_js = load_data_inline()
    html = html.replace('</head>', inline_data_js + '\n</head>')
    # Patch data URLs to use inlined data
    html = html.replace("'data/mp_climate_data.json'", "'data:,'")
    html = html.replace("'data/forecast_2040.json'", "'data:,'")
    html = html.replace("'data/dicra_ndvi.json'", "'data:,'")
    # Patch the loader to use inlined data
    html = html.replace(
        "fetch(DATA_URL)",
        "Promise.resolve(new Response(JSON.stringify(window._MERGED_CLIMATE_DATA), {status:200, headers:{'Content-Type':'application/json'}}))"
    )
    html = html.replace(
        "fetch(FORECAST_URL)",
        "Promise.resolve(new Response(JSON.stringify(window._MERGED_FORECAST_DATA), {status:200, headers:{'Content-Type':'application/json'}}))"
    )
    html = html.replace(
        "fetch('data/dicra_ndvi.json')",
        "Promise.resolve(new Response(JSON.stringify(window._MERGED_NDVI_DATA), {status:200, headers:{'Content-Type':'application/json'}}))"
    )
    return html

def main():
    st.markdown("""
        <style>
        .stApp { margin: 0; padding: 0; overflow: hidden; }
        iframe { width: 100vw; height: 100vh; border: none; }
        </style>
    """, unsafe_allow_html=True)
    
    html_content = get_html_content()
    # Use base64 encoding to avoid issues with special characters
    b64 = base64.b64encode(html_content.encode('utf-8')).decode()
    src = f'data:text/html;base64,{b64}'
    
    st.markdown(
        f'<iframe src="{src}" width="100%" height="100vh" frameborder="0" scrolling="no"></iframe>',
        unsafe_allow_html=True
    )

if __name__ == '__main__':
    main()
