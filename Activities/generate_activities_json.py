#!/usr/bin/env python3
"""
Auto-generate activities.json file by scanning the Activities folder.
This script detects all activities and their associated files automatically.
"""

import os
import json
import glob
from pathlib import Path

# Global toggle for passwords in the generated JSON
PASSWORDS_ENABLED = True

def find_activity_files(activities_dir):
    """Scan the activities directory and find all activity folders with their files."""
    activities = []
    
    # Get all subdirectories in the Activities folder
    for item in os.listdir(activities_dir):
        item_path = os.path.join(activities_dir, item)
        
        # Skip if not a directory
        if not os.path.isdir(item_path):
            continue
            
        # Skip if it's the current script's directory or other non-activity dirs
        if item in ['.git', '__pycache__', '.vscode']:
            continue
            
        activity_info = {
            "name": item,
            "displayName": item.replace('_', ' ').title(),  # Convert underscores to spaces and title case
            "image": None,
            "termsFile": None,
            "setupFile": None
        }
        
        # Look for PNG image files
        png_files = glob.glob(os.path.join(item_path, "*.png"))
        if png_files:
            # Use the first PNG file found and convert to forward slashes
            image_path = os.path.join("Activities", item, os.path.basename(png_files[0]))
            activity_info["image"] = image_path.replace("\\", "/")
        
        # Look for terms files (ending with _terms.txt)
        terms_files = glob.glob(os.path.join(item_path, "*_terms.txt"))
        if terms_files:
            # Use the first terms file found and convert to forward slashes
            terms_path = os.path.join("Activities", item, os.path.basename(terms_files[0]))
            activity_info["termsFile"] = terms_path.replace("\\", "/")
        
        # Look for setup files (ending with _setup.json)
        setup_files = glob.glob(os.path.join(item_path, "*_setup.json"))
        if setup_files:
            # Use the first setup file found and convert to forward slashes
            setup_path = os.path.join("Activities", item, os.path.basename(setup_files[0]))
            activity_info["setupFile"] = setup_path.replace("\\", "/")

        # Optional per-activity password from a file named exactly "password" or "password.txt"
        pw_file = os.path.join(item_path, "password")
        pw_file_txt = os.path.join(item_path, "password.txt")
        pw_path = pw_file if os.path.isfile(pw_file) else (pw_file_txt if os.path.isfile(pw_file_txt) else None)
        if pw_path:
            try:
                with open(pw_path, 'r', encoding='utf-8') as pf:
                    pw = pf.read().strip()
                    if pw:
                        activity_info["password"] = pw
            except Exception as e:
                print(f"  - Warning: could not read password file for '{item}': {e}")
        
        # Only add activities that have at least an image and terms file
        if activity_info["image"] and activity_info["termsFile"]:
            activities.append(activity_info)
            print(f"Found activity: {item}")
        else:
            print(f"Warning: Activity '{item}' is missing required files:")
            if not activity_info["image"]:
                print(f"  - No PNG image found")
            if not activity_info["termsFile"]:
                print(f"  - No terms file found")
            if not activity_info["setupFile"]:
                print(f"  - No setup file found")
    
    return activities

def generate_activities_json(activities_dir, output_file):
    """Generate the activities.json file."""
    print(f"Scanning activities directory: {activities_dir}")
    
    # Find all activities
    activities = find_activity_files(activities_dir)
    
    if not activities:
        print("No valid activities found!")
        return
    
    # Create the JSON structure
    activities_data = {
        "passwordsEnabled": PASSWORDS_ENABLED,
        "activities": activities
    }
    
    # Write to file - this will OVERWRITE the existing file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(activities_data, f, indent=2, ensure_ascii=False)
        
        print(f"\nSuccessfully OVERWROTE {output_file}")
        print(f"Found {len(activities)} activities:")
        
        for activity in activities:
            print(f"  - {activity['name']}")
            print(f"    Image: {activity['image']}")
            print(f"    Terms: {activity['termsFile']}")
            if activity['setupFile']:
                print(f"    Setup: {activity['setupFile']}")
            print()
            
    except Exception as e:
        print(f"Error writing to {output_file}: {e}")

def main():
    """Main function."""
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    
    # The script is in the Activities folder, so go up one level to find the parent
    parent_dir = script_dir.parent
    activities_dir = script_dir  # Activities folder is where the script is located
    
    # Output file path (in the parent directory, same level as Activities folder)
    output_file = parent_dir / "activities.json"
    
    print("Activities JSON Generator")
    print("=" * 40)
    print(f"Script location: {script_dir}")
    print(f"Activities directory: {activities_dir}")
    print(f"Output file: {output_file}")
    print("=" * 40)
    
    # Check if activities directory exists
    if not os.path.exists(activities_dir):
        print(f"Error: Activities directory not found at {activities_dir}")
        return
    
    # Generate the JSON file
    generate_activities_json(activities_dir, output_file)
    
    print("\nDone! The activities.json file has been OVERWRITTEN with the new data.")

if __name__ == "__main__":
    main()

